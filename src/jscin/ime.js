// Copyright 2024 Google Inc. All Rights Reserved.

/**
 * @fileoverview The Input Methods Environment for JsCIN
 * @author Hung-Te Lin <hungte@gmail.com>
 */

import { parseCin } from "./cin_parser.js";
import { applyInputMethodTableQuirks, postInputMethodTableQuirks } from './quirks.js';
import { ChromeStorage, Storage, LoadText } from "./storage.js";

import { AddLogger } from "./logger.js";
const {debug, warn, error, assert} = AddLogger("jscin.ime");

/* Key names in the storage. */
export const KEY_INFO_LIST = "info_list";
export const KEY_TABLE_PREFIX = "table-";
export const KEY_OPTS_PREFIX = "opts-";

export const OPTS = {
  AUTO_UPCHAR: true,
  SPACE_AUTOUP: true,
  SELKEY_SHIFT: false,

  SPACE_RESET: true,
  AUTO_RESET: false,

  AUTO_COMPOSE: true,
  flag_disp_partial_match: false,
  flag_unique_auto_send: false,

  AUTO_FULLUP: false,
  space_auto_first_full: false,

  WILD_ENABLE: true,

  END_KEY: false,
};

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
 * for quick accessing the info (to show to the user). The info can always be
 * restored from the table, which has everything:
 * - cin (The raw parsed results from the *.cin table)
 *   = ename, cname, chardef
 * - info
 *   = ename, cname, url(optional)
 *
 * `ename` and `cname` are in info because that's always required for display.
 * `url` is in info because for any reason we can't find the table, we may
 * always re-download the table by the URL.
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
 *  ime.saveTable(name, cin, url);
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
  constructor(storage) {

    if (!storage) {
      if (globalThis.chrome?.storage.local) {
        storage = new ChromeStorage();
      } else {
        storage = new Storage();
        debug("InputMethodsEnvironment: Selected Storage for new storage debugging.");
      }
    }
    this.storage = storage;

    this.info_list = {};
    this.cache = {}
    this.modules = {};
    this.fallback_module = null;
    this.addons = []; // Tables must be chained in order so this is an array.
    this.callbacks = {
      [KEY_INFO_LIST]: [],
      [KEY_TABLE_PREFIX]: [],
    };

    this.MIGRATION = true;
    this.OPTS = OPTS;
  }

  async initialize() {
    await this.loadTableInfoList();

    this.storage.listen((changes) => {this.onChanged(changes);});
    this.addTableChangeListener(this.cbTableChangeUpdateCache.bind(this));

    return true;
  }

  // ----- Callbacks -----

  onChanged(changes) {
    for (let k in changes) {
      if (k == KEY_INFO_LIST) {
        debug("onChanged - TableInfoList", changes[k]);
        this.info_list = changes[k]?.newValue;
        for (let c of this.callbacks[KEY_INFO_LIST]) {
          c(this.info_list);
        }
        continue;
      }
      if (k.startsWith(KEY_TABLE_PREFIX)) {
        const name = this.tableName(k);
        const v = changes[k]?.newValue;
        debug('onChanged - Table', k, name, v, this.callbacks);
        for (let c of this.callbacks[KEY_TABLE_PREFIX]) {
          c(name, v);
        }
        continue;
      }
    }
  }

  // Callback prototype: (info_list)=>{}
  addTableInfoListListener(callback) {
    this.callbacks[KEY_INFO_LIST].push(callback);
  }
  // Callback prototype: (name, table)=>{}
  addTableChangeListener(callback) {
    this.callbacks[KEY_TABLE_PREFIX].push(callback);
  }

  // Table callback: update cache
  cbTableChangeUpdateCache(name, table) {
    if (table)
      this.cache[name] = table;
    else
      delete this.cache[name];
  }

  // ----- Modules -----

  registerModule(constructor, name=constructor.name) {
    if (!this.fallback_module)
      this.fallback_module = constructor;

    assert(!(name in this.modules), "Already registered:", name);
    this.modules[name] = constructor;
    debug("Registered module:", name);
  }

  // To get the fallback module: getModule()
  // Toe get the name of the fallback moduel: getModule()?.name
  getModule(name) {
    if (typeof(name) == 'function')
      return name;
    if (name) {
      const m = this.modules[name];
      if (m)
        return m;
      warn("Warning: module does not exist, will use the fallback module:",
        name, "=>", this.fallback_module?.name);
    }
    assert(this.fallback_module, "No modules available yet.");
    return this.fallback_module;
  }

  getModuleNames() {
    return Object.keys(this.modules);
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
  tableName(key) {
    return key.substring(KEY_TABLE_PREFIX.length);
  }
  optsKey(name) {
    return `${KEY_OPTS_PREFIX}${name}`;
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

  /* An FNV-1A implementation */
  getHash(s, h=0x811c9dc5) {
    for (let c of s) {
      h ^= c.charCodeAt(0);
      h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
    }
    return (h >>> 0).toString(16);
  }

  parseCinFromString(str) {
    debug("parseCinFromString:", str.substring(0, 40), '...');
    let [success, cin, msg] = parseCin(str);

    if (!success || !cin) {
      debug("Failed parsing: ", msg, str);
      return false;
    }
    return cin;
  }

  getTableSaveName(cin, url) {
    const name = cin.sname || cin.ename;
    const hash = this.getHash(url || `${name}.cin`);
    return `${name}#${hash}`;
  }

  createTable(cin, url, name) {
    if (typeof(cin) == typeof(''))
      cin = this.parseCinFromString(cin);
    if (!cin || !this.isValidCIN(cin)) {
      debug("createTable: Invalid CIN:", cin);
      return false;
    }
    if (!name) {
      name = this.getTableSaveName(cin, url);
    }
    debug("createTable:", "name=>", name, "url=>", url, "cin=>", cin);
    // Now, create the table.
    let table = {
      cin,
      info: {
        ename: cin.ename,
        cname: cin.cname,
        name,
        url,
      },
    };

    if (!this.isValidTable(table)) {
      debug("createTable: Invalid table", table);
      return false;
    }
    debug("Created table:", table);
    return table;
  }

  // Filter out OPTS commands from the cin commands
  cin2Opts(cin) {
    let opts = {};
    for (let k in this.OPTS) {
      if (k in cin)
        opts[k] = cin[k];
    }
    debug("cin2Opts:", cin, '->', opts);
    return opts;
  }

  // Check the (CIN) table and figure out the default opts.
  getTableDefaultOpts(cin) {
    if (!cin)
      return structuredClone(this.OPTS);
    let quirk = structuredClone(cin);
    applyInputMethodTableQuirks(quirk);
    return this.cin2Opts(quirk);
  }

  async saveTable(name, cin, url, save_in_storage=true) {
    let table = this.createTable(cin, url, name);
    if (!table)
      return false;

    name = table.info.name;
    const key = this.tableKey(name);
    debug("saveTable:", name, key, table);
    this.cache[name] = table;
    this.info_list[name] = structuredClone(table.info);
    // For built-in tables, we may want to skip saving the whole table in the
    // storage.
    if (save_in_storage)
      await this.storage.set(key, table);
    debug("saveTable: new info_list=", this.info_list);
    await this.saveTableInfoList();

    if (!await this.loadOpts(name))
      await this.saveOpts(name, this.getTableDefaultOpts(table.cin));

    return name;
  }

  async removeTable(name, keep_opts) {
    const key = this.tableKey(name);
    debug("Removing the table for:", name, key);
    delete this.info_list[name];
    delete this.cache[name];

    await this.storage.remove(key);
    if (!keep_opts)
      await this.removeOpts(name);
    await this.saveTableInfoList();
    return true;
  }

  async loadOpts(name) {
    const key = this.optsKey(name);
    debug("Loading opts:", name, '->', key);
    // All opts should be processed in saveTable.
    // And defaults should be applied in the applyInputMethodTableQuirks
    // so we don't need to create another 'default' here.
    return await this.storage.get(key);
  }

  async saveOpts(name, opts) {
    const key = this.optsKey(name);
    debug("Saving opts:", name, '->', key, '->', opts);
    await this.storage.set(key, opts);
  }

  async removeOpts(name) {
    const key = this.optsKey(name);
    debug("Remove opts for:", name, key);
    await this.storage.remove(key);
  }

  async loadTable(name, url) {
    let table = this.cache[name]
    if (table)
      return table;

    const key = this.tableKey(name);
    debug("Loading the table for:", name, key);
    table = await this.storage.get(key);

    // Although we may find the URL from this.getTableInfo,
    // we want an explicit confirmation "allow to load from URL".
    if (!table) {
      if (!url)
        url = this.getTableInfo(name)?.url;
      if (!url) {
        error("Cannot find table, also no URL to re-load:", name);
        return undefined;
      }
      let start = performance.now();

      debug("Getting remote table:", url);
      let contents = await LoadText(url);
      if  (contents)
        table = this.createTable(contents, url);
      debug("Loaded and parsed table:", Math.round(performance.now() - start), "ms");
    }

    if (!table) {
      warn("Missing data for:", name, key);
      return undefined;
    }
    assert(this.isValidTable(table), "Saved tables should be valid", table);
    this.cache[name] = table;

    if (!this.info_list[name]) {
      assert(this.info_list[name], "Missing info for loaded table", name);
      this.info_list[name] = table.info;
      await this.saveTableInfoList();
    }

    return table;
  }

  freeTable(name) {
    delete this.cache[name];
  }

  // ----- Table Info -----

  async loadTableInfoList() {
    this.info_list = await this.storage.get(KEY_INFO_LIST);
    if (!this.info_list) {
      this.info_list = {};
    }
    return this.info_list;
  }

  async saveTableInfoList(info_list) {
    if (info_list)
      this.info_list = info_list;
    return this.storage.set(KEY_INFO_LIST, this.info_list);
  }

  getTableInfo(name) {
    return this.info_list[name];
  }
  getTableInfoList() {
    return this.info_list;
  }
  getLabel(name) {
    assert(name in this.info_list, "Does not exist in info_list:", name, this.info_list);
    return this.info_list[name]?.cname;
  }
  getInfo(name) {
    return this.getTableInfo(name);
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
      let name = key.substring(KEY_TABLE_PREFIX);
      let info_name = table.info.name || table.info.ename;
      if (name != info_name) {
        warn("Warning: info name is different from table key name:", info_name, "!=", name);
        table.info.name = name;
      }
      list[name] = table.info;
    }
    debug("Rebuild finished.", list);
    return this.saveTableInfoList(list);
  }

  // ----- Input Methods -----

  /* TODO(hungte) Should we make this sync and only allow loaded table? */
  async activateInputMethod(name, ctx, table, opts, module) {
    debug("Activating input method:", name);

    // table: from param, or from storage.
    if (!table)
      table = await this.loadTable(name);
    if (!table || !table.cin) {
      error("No table found for:", name);
      return;
    }
    if (!opts)
      opts = (await this.loadOpts(name) || {});

    // module: from param (string or constructor),
    // from table, or the fallback.
    module = this.getModule(module || table.cin.MODULE);
    assert(module, "activateInputMethod: No any modules available:", name);

    // The quirks may change CIN content that was cached so we want to modify
    // only the cloned copy.
    let cin = structuredClone(table.cin);

    applyInputMethodTableQuirks(cin);
    // Overwrite opts from stored values (must be done after
    // applyInputMethodTableQuirks).
    Object.assign(cin, opts);
    postInputMethodTableQuirks(cin);

    let instance = new module(name, cin);
    debug("activateInputMethod: Created input method:", name, opts, instance, module.name);

    for (let addon of this.addons)
      instance = new addon('addon', instance);

    instance.init(ctx);
    return instance;
  }
}
