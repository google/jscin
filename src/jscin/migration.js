// Copyright 2024 Google Inc. All Rights Reserved.

/**
 * @fileoverview All migration stuff.
 * @author Hung-Te Lin <hungte@gmail.com>
 */

import { AddLogger } from "./logger.js";
const {log, debug, info, warn, error, assert, trace} = AddLogger("migration");

import {ChromeStorage, CompressedStorage, Storage} from "./storage.js";
import {KEY_INFO_LIST, KEY_TABLE_PREFIX} from "./ime.js";

const kConfigInputMethods = "InputMethods";
const kOldConfigInputMethods = 'croscinPrefEnabledInputMethodList';
const kOldTableMetadataKey = "table_metadata";
const kOldTableDataKeyPrefix = "table_data-";
const kOldPhrasesDatabaseKey = 'croscinPhrasesDatabase';
const kOldVersion = 'version';

// Snippet from cin_parser.js
function normalizeEName(data) {

  function parseLocales(intlname) {
    const re = /(?<label>[^:;]+):(?<locale>[^:;]+);?/g;
    let result = {}
    for (let m of intlname.matchAll(re)) {
      result[[m.groups.locale]] = m.groups.label;
    }
    if (!Object.keys(result).length)
      return null;
    return result;
  }

  const ename = data.ename;
  if (!ename.includes(':') || !ename.includes(';'))
    return;

  let r = parseLocales(ename);
  if (!r || !r.en)
    return;

  data.intlname = data.intlname || ename;
  data.ename = r.en;
}

export class Migration {
  constructor(ime, storage, old_storage) {
    if (!storage) {
      if (globalThis.chrome?.storage.local) {
        storage = new ChromeStorage();
      } else {
        storage = new Storage();
        debug("Migration: Selected Storage for new storage debugging.");
      }
    }
    if (!old_storage) {
      if (globalThis.localStorage) {
        old_storage = new CompressedStorage();
      } else {
        old_storage = new Storage();
        debug("Migration: Selected Storage for old storage for debugging.");
      }
    }
    this.storage = storage;
    this.old_storage = old_storage;
    this.ime = ime;
  }

  // Migrate from version <= v2.27.0
  migrateTable(data, meta) {
    if ('cin' in data)
      return data;

    // Ok, not a new format; let's try if it's ok for migration
    if (!data.ename || !data.cname || !data.chardef) {
      error("migrateTable: Unkown format:",  data.ename, data);
      return data;
    }

    // Fix broken table ename
    normalizeEName(data);

    function renameProperty(obj, old_name, new_name) {
      if (!obj || !(old_name in obj))
        return;
      obj[new_name] = obj[old_name]
      delete obj[old_name];
    }

    let type = structuredClone(meta.setting);
    renameProperty(type, 'options', 'cin');
    renameProperty(type, 'by_auto_detect', 'auto_detect');

    // meta.ename may be broken; table.ename was fixed.
    if (!meta.url)
      meta.url = data.ename + ".cin";

    let table = this.ime.createTable(data, meta.url, type);
    debug("Migrated the table to new format:", table.info.name, data, "=>", table);
    return table;
  }

  async migrateAllTables(force) {

    let start = performance.now();
    // Note we are not deleting the old table so users may switch between,
    // however that means we have to delete both the old and new tables
    // when removing a table in the Options.
    let delete_old = true;
    let parallel = true;
    // The 'enabled' is actually a croscin config but we have to migrate it
    // here as well, assuming the storage backend is the same.
    let enabled = (await this.storage.get(kConfigInputMethods)) ||
      (await this.old_storage.get(kOldConfigInputMethods)) || [];
    let old_meta = await this.old_storage.get(kOldTableMetadataKey);
    let infos = await this.storage.get(KEY_INFO_LIST) || {};
    debug("migrateAllTables: start to check...", old_meta, infos, enabled);
    let waits = [];
    let url_base = chrome.runtime.getURL("");
    // In case old_meta was corrupted, we want to keep migrating even if the
    // metadata does not have the right info, as long as the table is valid.
    for (let k of await this.old_storage.getKeys()) {
      if (!k.startsWith(kOldTableDataKeyPrefix))
        continue;
      assert(kOldTableDataKeyPrefix.endsWith('-'),
             "The old table data key must end with '-'");
      let old_name = k.substring(kOldTableDataKeyPrefix.length);
      let meta = old_meta[old_name] ||{};
      if (meta.builtin || meta.url?.startsWith(url_base)) {
        debug("Ignore built-in table:", old_name);
        const new_prefix = 'jscin.'; // See tables/builtin.json
        if (enabled.includes(old_name) && !old_name.startsWith(new_prefix))
          enabled[enabled.indexOf(old_name)] = `${new_prefix}${old_name}`;
        if (delete_old)
          this.old_storage.remove(k);
        continue;
      }
      let table = this.migrateTable(await this.old_storage.get(k), meta);
      // Now we have a new table, and the name may have changed.
      let new_name = table.info.name;
      debug("Checking if we need to migarte the old table:", new_name, k);
      let new_k = this.ime.tableKey(new_name);
      assert(new_k != k, "The key must be different for migration", k, new_k);
      if (enabled.includes(old_name) && !enabled.includes(new_name)) {
        enabled[enabled.indexOf(old_name)] = new_name;
        debug("Changing enabled IMs:", old_name, new_name, enabled);
      }
      if (await this.storage.has(new_k) && !force) {
        debug("New table is already there, skip:", new_name, new_k);
        if (delete_old)
          this.old_storage.remove(k);
        continue;
      }
      infos[new_name] = table.info;
      let w = this.storage.set(new_k, table);
      if (delete_old)
        this.old_storage.remove(k);
      if (parallel)
        waits.push(parallel);
      else
        await w;
    }
    await this.storage.set(KEY_INFO_LIST, infos);
    await this.storage.set(kConfigInputMethods, enabled);
    if (delete_old) {
      this.old_storage.remove(kOldTableMetadataKey);
      this.old_storage.remove(kOldConfigInputMethods);
      this.old_storage.remove(kOldPhrasesDatabaseKey);
      this.old_storage.remove(kOldVersion);
    }
    /* Wait for all storage.set to finish. */
    for (let w of waits)
      await w;
    let exec = Math.round(performance.now() - start);
    debug("migrateTable: All tables migrated.", infos, exec, "ms");
    console.log(`Migration/${parallel ? "parallel" : "single-thread"} ${exec} ms.`);
  }

  async removeLegacyBackupTables() {
    // These backups won't be really used. Instead we do the migration.
    let keys = await this.storage.getKeys();
    let to_remove = keys.filter((v)=>v.startsWith(kOldTableDataKeyPrefix));
    debug("removeLegacyBackupTables:", to_remove);
    for (let k of to_remove)
      this.storage.remove(k);
  }

  removeLocalStorageData() {
    if (!globalThis.localStorage)
      return;

    // Raw tables
    const kRawdataKeyPrefix = "raw_data-";
    // Oauth credentials
    const kOauthPrefix = "oauth";

    // Maybe in a service worker
    if (!globalThis.localStorage)
      return;

    for (let k in localStorage) {
      if (k.startsWith(kRawdataKeyPrefix) ||
          k.startsWith(kOauthPrefix))
        delete localStorage[k];
    }
  }

  async migrateAll(force) {
    this.removeLocalStorageData();
    this.removeLegacyBackupTables();
    return this.migrateAllTables(force);
  }
}
