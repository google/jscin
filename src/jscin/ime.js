// Copyright 2011 Google Inc. All Rights Reserved.

/**
 * @fileoverview The Input Methods Environment for JsCIN
 * @author Hung-Te Lin <hungte@gmail.com>
 */

import { parseCin } from "./cin_parser.js";
import { applyInputMethodTableQuirks } from './quirks.js';
import { CompressedStorage, ChromeStorage, Storage } from "./storage.js";

import { AddLogger } from "./logger.js";
const {log, debug, info, warn, error, assert, trace, logger} = AddLogger("jscin");

/* Key names in the storage. */
const KEY_INFO_LIST = "info_list";
const KEY_TABLE_PREFIX = "table-";

/*
 * The environment to manage all (table-based) input methods.
 *
 * An input method is a combination of:
 *
 * - a table (for the data of the mappings and rules: *.cin).
 * - a module (the program to apply the table: inp_*.js)
 * - a context (for the live execution).
 *
 * And optionally:
 * - a list of setting (extension to the table).
 * - a list of addon (extension to the module: addon_*.js)
 *
 * The input method is named by the table.
 *
 * Reading the tables may take a long time, so we also maintain an 'info_list'
 * (previously 'table metadata', basically the same) for the quick access to
 * the info of the table. The info can always be restored from the table.
 *
 * In jscin v2, the table data doesn't include the metadata. The metadata
 * - ename (same as ename in the table)
 * - cname (same as cname in the table)
 * - module (same as %MODULE in the table)
 * - builtin (optional, not in table)
 * - url (optional, not in table)
 * - setting (builtin_options.json, not in table but some options merged into table)
 *
 * In v3 we want to unify so the table always have everything:
 * - cin (The raw parsed results from the *.cin table)
 *   = ename, cname, chardef
 * - info
 *   = ename, cname, url(optional)
 * - setting (optional)
 *
 * `ename` and `cname` are in info because that's always required for display.
 * `url` is in info because for any reason we can't find the table, we may
 * always re-download the table by the URL.
 *
 * To allow switching between versions, the key names in the storage are also
 * different.
 *
 * USAGE
 *
 *  // Packages setup
 *
 *  ime = new InputMethodsEnvironment();  // Defaults to use chrome.storage.
 *  await ime.initialize();
 *
 *  // To see what tables are available:
 *  ime.getTableNames();
 *
 *  // Get the list of table information for display:
 *  ime.getTableInfoList();
 *
 *  // Install a new table
 *  ime.saveTable(cin, url, setting);
 *
 * // Start a new input method:
 * let ctx = {};
 * let im = ime.activateInputMethod('arary30', ctx);
 * result = im.keystroke(KeyboardEvent);
 *
 * if (result == jscin.IMKEY_COMMIT) {
 *   console.log(ctx.cch);
 *   ctx.cch = '';
 * }
 * // TODO: Rewrite the interface for IMs so the UI provider can be easier to
 * implement, not directly looking at the CTX.
 */

export class InputMethodsEnvironment {
  constructor(storage, old_storage) {
    if (!storage) {
      if (globalThis.chrome?.storage.local) {
        storage = new ChromeStorage();
      } else {
        storage = new Storage();
        debug("InputMethodsEnvironment: Selected Storage for new storage debugging.");
      }
    }
    if (!old_storage) {
      if (globalThis.localStorage) {
        old_storage = new CompressedStorage();
      } else {
        old_storage = new Storage();
        debug("InputMethodsEnvironment: Selected Storage for old storage for debugging.");
      }
    }
    this.storage = storage;
    this.old_storage = old_storage;

    this.info_list = {};
    this.tables = {}
    this.modules = {};
    this.addons = []; // Tables must be chained in order so this is an array.

    // REMOVE THIS: debug in development.
    logger.enable();
  }

  async initialize() {
    await this.loadTableInfoList();
    return true;
  }

  // ----- Modules -----

  registerModule(constructor, name=constructor.name) {
    if (!this.getModuleNames().length)
      this.modules[undefined] = constructor;

    assert(!(name in this.modules), "Already registered:", name);
    this.modules[name] = constructor;
    debug("Registered module:", name);
  }

  getModule(name) {
    if (name in this.modules)
      return this.modules[name];

    const m = this.modules[undefined];
    if (name && m) {
      warn("Warning: module does not exist, will fallback to default",
        name, m.name);
    }
    return m;
  }

  getModuleNames() {
    return Object.keys(this.modules);
  }

  getDefaultModuleName() {
    assert(this.getModuleNames().length, "No modules registered");
    return this.modules[undefined].name;
  }

  // ----- Addons -----

  registerAddon(constructor, name=constructor.name) {
    this.addons.push(constructor);
    debug("Registered addon:", name);
  }

  // ----- Tables -----

  /* The key name of the table. */
  tableKey(name) {
    return `${KEY_TABLE_PREFIX}${name}`;
  }

  isValidCIN(cin) {
    if (cin &&
        cin.ename &&
        cin.cname &&
        cin.chardef)
      return true;
    return false;
  }

  isValidTable(table) {
    if (table.info &&
        table.info.ename &&
        this.isValidCIN(table.cin))
      return true;
    return false;
  }

  parseCinFromString(cin) {
    debug("parseCinFromString:", cin.substring(0, 40), '...');
    // TODO(hungte) Dyanmic load cin_parser
    let [result, parsed] = parseCin(cin);

    if (!result || !parsed.data) {
      error("Failed parsing:", cin);
      return false;
    }
    return parsed.data;
  }

  createTable(cin, url, setting) {
    if (typeof(cin) == typeof(''))
      cin = this.parseCinFromString(cin);
    if (!cin || !this.isValidCIN(cin)) {
      debug("createTable: Invalid CIN:", cin);
      return false;
    }
    debug("createTable:", "cin=>", cin, "url=>", url, "setting=>", setting);
    // Now, create the table.
    let table = {
      cin: cin,
      info: {
        ename: cin.ename,
        cname: cin.cname,
        url: url,
      },
      setting: setting,
    };

    if (!this.isValidTable(table)) {
      debug("createTable: Invalid table", table);
      return false;
    }
    debug("Created table:", table);
    return table;
  }

  async saveTable(cin, url, setting) {
    let table = this.createTable(cin, url, setting);
    if (!table)
      return false;

    let name = table.info.ename;
    const key = this.tableKey(name);
    debug("saveTable:", name, key, table);
    this.tables[name] = table;
    this.info_list[name] = structuredClone(table.info);
    await this.storage.set(key, table);
    debug("saveTable: new info_list=", this.info_list);
    await this.saveTableInfoList();
    return name;
  }

  async removeTable(name) {
    const key = this.tableKey(name);
    debug("Removing the table for:", name, key);
    delete this.info_list[name];
    delete this.tables[name];
    await this.storage.remove(key);
    await this.saveTableInfoList();
    return true;
  }

  async loadTable(name) {
    let table = this.tables[name]
    if (table)
      return table;

    const key = this.tableKey(name);
    debug("Loading the table for:", name, key);
    table = await this.storage.get(key);

    if (!table) {
      warn("Missing data for:", name, key);
      return undefined;
    }
    assert(this.isValidTable(table), "Saved tables should be valid", table);
    this.tables[name] = table;

    if (!this.info_list[name]) {
      assert(this.info_list[name], "Missing info for loaded table", name);
      this.info_list[name] = table.info;
      await this.saveTableInfoList();
    }

    return table;
  }

  freeTable(name) {
    delete this[name];
  }

  // ----- Table Info -----

  async loadTableInfoList() {
    this.info_list = await this.storage.get(KEY_INFO_LIST);
    if (!this.info_list) {
      this.info_list = {};
    }
    return this.info_list;
  }

  async saveTableInfoList(info) {
    if (info)
      this.info_list = info;
    return this.storage.set(KEY_INFO_LIST, this.info_list);
  }

  getTableInfo(name) {
    return this.info_list[name];
  }
  getTableInfoList() {
    return this.info_list;
  }
  getTableNames() {
    return Object.keys(this.info_list);
  }

  async rebuildTableInfoList() {
    // Assuming all tables are valid and correct.
    // Reading table is async so we can't use filter()+map().
    debug("Rebuilding the info list...");
    let list = {};
    for (let key of await this.storage.getKeys()) {
      if (!key.startsWith(KEY_TABLE_PREFIX))
        continue;
      let table = await this.storage.get(key);
      if (!this.isValidTable(table))
        warn("Warning: found invalid table:", table);
      list[table.info.ename] = table.info;
    }
    debug("Rebuild finished.", list);
    return this.saveTableInfoList(list);
  }

  // ----- Migration -----

  // Migrate from version <= v2.27.0
  migrateTable(data, meta) {
    if ('cin' in data)
      return data;

    // Ok, not a new format; let's try if it's ok for migration
    if (!data.ename || !data.cname || !data.chardef) {
      error("migrateTable: Unkown format:",  data.ename, data);
      return data;
    }

    let info = meta[data.ename] || {};
    let table = this.createTable(data, meta.url, meta.setting);
    debug("Migrated the table to new format:", table.cin.ename, data, "=>", table);
    return table;
  }

  async migrateAllTables() {
    const kTableOldMetadataKey = "table_metadata";
    const kTableOldDataKeyPrefix = "table_data-";

    let old_meta = await this.old_storage.get(kTableOldMetadataKey);
    let infos = await this.storage.get(KEY_INFO_LIST) || {};
    debug("migrateAllTables: start to check...", old_meta, infos);
    // In case old_meta was corrupted, we want to keep migrating even if the
    // metadata does not have the
    for (let k of await this.old_storage.getKeys()) {
      if (!k.startsWith(kTableOldDataKeyPrefix))
        continue;
      assert(kTableOldDataKeyPrefix.endsWith('-'),
             "The old table data key must end with '-'");
      let name = k.substring(kTableOldDataKeyPrefix.length);
      let meta = old_meta[name] ||{};
      if (meta.builtin) {
        debug("Ignore built-in table:", name);
        continue;
      }
      debug("Checking if we need to migarte the old table:", name, k);
      let new_k = this.tableKey(name);
      assert(new_k != k, "The key must be different for migration", k, new_k);
      if (await this.storage.has(new_k)) {
        debug("New table is already there, skip:", name, new_k);
        continue;
      }
      // Now we have a new table.
      let table = this.migrateTable(await this.old_storage.get(k), meta);
      infos[name] = table.info;
      await this.storage.set(new_k, table);
    }
    await this.storage.set(KEY_INFO_LIST, infos);
    debug("migrateTable: All tables migrated.", infos);
  }

  // ----- Input Methods -----

  /* TODO(hungte) Should we make this sync and only allow loaded table? */
  async activateInputMethod(name, ctx, table, module) {
    debug("Activating input method:", name);

    // table: from param, or from storage.
    if (!table)
      table = await this.loadTable(name);
    if (!table) {
      error("No table found for:", name);
      return;
    }

    // module: from param (string or constructor),
    // from table, or default.
    if (!module) {
      module = table.cin.MODULE;
    }
    if (typeof(module) == typeof('')) {
      module = this.modules[module];
    }
    if (!module) {
      module = this.modules[undefined];
      debug("activateInputMethod: Fallback the module to the default", module.name);
    }
    assert(module, "activateInputMethod: No any modules available:", name);

    // Apply options not in the original CIN (for example added by jscin
    // auto-detected rules)
    let opt = table?.setting?.options || {};
    Object.assign(table.cin, opt);

    // Apply final quirks. This must be done after the table.setting because
    // some quirks may be triggered only after the table.settings is applied.
    applyInputMethodTableQuirks(table.cin);

    let instance = new module(name, table.cin);
    debug("activateInputMethod: Created inpue mthod:", name, instance);

    this.addons.forEach((addon) => {
      instance = new addon('addon', instance);
    });

    instance.init(ctx);
    return instance;
  }
}
