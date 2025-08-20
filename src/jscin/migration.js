// Copyright 2024 Google Inc. All Rights Reserved.

/**
 * @fileoverview All migration stuff.
 * @author Hung-Te Lin <hungte@gmail.com>
 */

import { AddLogger } from "./logger.js";
const {log, debug, info, warn, error, assert, trace} = AddLogger("migration");

import {ChromeStorage, Storage} from "./storage.js";
import {KEY_INFO_LIST, KEY_TABLE_PREFIX} from "./ime.js";

const kOldTableDataKeyPrefix = "table_data-";

export class Migration {
  constructor(ime, storage) {
    if (!storage) {
      if (globalThis.chrome?.storage.local) {
        storage = new ChromeStorage();
      } else {
        storage = new Storage();
        debug("Migration: Selected Storage for new storage debugging.");
      }
    }
    this.storage = storage;
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
    let parallel = true;
    let url_base = chrome.runtime.getURL("");
    debug("migrateAllTables: start to check...");
    let waits = [];

    for (let k of await this.storage.getKeys()) {
      if (!k.startsWith(KEY_TABLE_PREFIX))
        continue;

      // Migrate table k if needed.
      let need_migrate = false;
      if (!need_migrate)
        continue;

      // Update table here
      let table = this.migrateTable(await this.storage.get(k));

      let w = this.storage.set(k, table);
      if (parallel)
        waits.push(w);
      else
        await w;
    }

    /* Wait for all waits (e.g., storage.set) to finish. */
    for (let w of waits)
      await w;
    let exec = Math.round(performance.now() - start);
    debug("migrateTable: All tables migrated.", exec, "ms");
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

  async migrateAll(force) {
    this.removeLegacyBackupTables();
    return this.migrateAllTables(force);
  }
}
