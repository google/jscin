// Copyright 2024 Google Inc. All Rights Reserved.

/**
 * @fileoverview All migration stuff.
 * @author Hung-Te Lin <hungte@gmail.com>
 */

import { AddLogger } from "./logger.js";
const {log, debug, info, warn, error, assert, trace} = AddLogger("migration");

import {ChromeStorage, Storage} from "./storage.js";
import {KEY_TABLE_PREFIX} from "./ime.js";

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

  // Migrate from version <= v3.0.2
  migrateTable(data) {
    let modified = false;
    let chardef = data.cin.chardef;
    for (let k in chardef) {
      let v = chardef[k];
      if (typeof(v) == 'string') {
        chardef[k] = v.split('');
        modified = true;
      }
    }
    if (data.cin.PHRASE_CHARDEF) {
      delete data.cin.PHRASE_CHARDEF;
      modified = true;
    }
    return [modified, data];
  }

  async migrateAllTables(force) {

    let start = performance.now();
    let parallel = true;
    debug("migrateAllTables: start to check...");
    let waits = [];

    for (let k of await this.storage.getKeys()) {
      if (!k.startsWith(KEY_TABLE_PREFIX))
        continue;

      let src = await this.storage.get(k);
      let [need_update, output] = this.migrateTable(src)

      if (!need_update) {
        debug("Migration not needed:", k);
        continue;
      } else {
        debug("Migrated (saving):", k);
      }

      let w = this.storage.set(k, output);
      if (parallel)
        waits.push(w);
      else
        await w;
    }

    /* Wait for all waits (e.g., storage.set) to finish. */
    for (let w of waits)
      await w;
    let exec = Math.round(performance.now() - start);
    debug("migrateTable: Migrated all tables.", exec, "ms");
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
