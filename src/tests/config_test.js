// Copyright 2024 Google Inc. All Rights Reserved.
// @author hungte@gmail.com (Hung-Te Lin)

import { Config } from "../chrome/config.js";
import { AddLogger } from "../jscin/logger.js";
const {log, debug, info, warn, error, assert, trace, logger} = AddLogger("config_test");

////// Tests and emulation

class FakeStorage {
  constructor(onChanged) {
    this.data = {};
    this.onChanged = onChanged;
  }
  clone(obj) {
      return JSON.parse(JSON.stringify(obj));
  }
  async get(items) {
    log("FakeStorage.get:", items);
    let data = Object.fromEntries(
      items.map((key) => [key, this.data[key]]));
    return data;
  }
  async set(data) {
    log("FakeStorage.set:", data);
    log("FakeStorage.set, before:", this.data);
    Object.assign(this.data, data);
    log("FakeStorage.set, after:", this.data);
    if (this.onChanged)
      this.onChanged(
        Object.fromEntries(Object.keys(data).map(
          (k)=>[k, {newValue: this.data[k]}])));
    return data;
  }
}

async function test() {
  let a = new Config(FakeStorage);
  a.Bind("Emulation",           (flag) => {log("TEST: Changed Emulation to", flag);});
  a.Bind("AddonRelatedText",    (flag) => {log("TEST: Changed AddonRelatedText to", flag);});
  a.Bind("AddonPunctuations",   (flag) => {log("TEST: Changed AddonPunctuations to", flag);});
  a.Bind("InputMethods",        (list) => {log("TEST: Changed InputMethods to", list);});
  console.log("TEST: save");
  await a.Save();
  console.log("TEST: load");
  await a.Load();
  console.log("TEST: sst");
  await a.Set("Emulation", true);
  log("Default Input Method:", a.DefaultInputMethod());
  await a.Set("InputMethods", ["array30", "phone"]);
  log("Default Input Method:", a.DefaultInputMethod());
  await a.Set("InputMethods", ["changjei", "phone"]);
  log("Default Input Method:", a.DefaultInputMethod());

  log("FakeStorage data:", a.storage.data);
  log("Config data:", a.config);

  log("Test function completed");
}

test();
