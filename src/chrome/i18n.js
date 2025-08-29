// Copyright 2025 Google Inc. All Rights Reserved.

/**
 * @fileoverview chrome.i18n replacement
 * @author hungte@gmail.com (Hung-Te Lin)
 */

import { Config } from "./config.js";
import { LoadJSON } from "../jscin/storage.js";

class I18n {
  constructor() {
    this.locales = {"en": {}, "zh_TW": {}};
    this.current = "en";
  }

  async load_db() {
    for (let l in this.locales) {
      this.locales[l] = await LoadJSON(`_locales/${l}/messages.json`);
    }
  }

  setLocale(l) {
    if (!this.locales[l])
      return;
    this.current = l;
  }

  getMessage(key, substitutions) {
    let db = this.locales[this.current];
    let ret = db[key]?.message;
    if (!ret)
      return '';

    let args = substitutions;
    if (!args)
      return ret;

    if (typeof(args) == 'string')
      args = [args];

    // Can't use `i in args` because we want to keep i as a number.
    for (let i = 0; i < args.length; i++) {
      let pattern = `$${i+1}`;
      ret = ret.replace(pattern, args[i]);
    }
    return ret;
  }
}

async function Init() {
  let native = chrome.i18n?.getMessage;
  let config = new Config();
  await config.Load();

  if (native && !config.Debug())
    return native;

  let myi18n = new I18n();
  await myi18n.load_db();
  myi18n.setLocale(config.Locale());
  console.log("Using debug locale", myi18n);

  config.Bind("Locale", (value) => {
    console.log("Setting locale", value);
    myi18n.setLocale(value);
  });

  return myi18n.getMessage.bind(myi18n);
}

export const _ = await Init();
