// Copyright 2025 Google Inc. All Rights Reserved.

/**
 * @fileoverview chrome.i18n replacement
 * @author hungte@gmail.com (Hung-Te Lin)
 */

import { Config } from "./config.js";
import { LoadJSON } from "../jscin/storage.js";

class I18n {
  constructor(native) {
    const zhTW = 'zh_TW', en = 'en';
    this.native = native;
    this.locales = {[en]: {}, [zhTW]: {}};
    this.default = en;
    this.alt = zhTW;
    if (chrome?.i18n?.getUILanguage().startsWith(zhTW)) {
      this.default = zhTW;
      this.alt = en;
    }
    this.current = this.default;
  }

  setAltLocale(use_alt) {
    if (use_alt)
      this.current = this.alt;
    else
      this.current = this.default;
    console.assert(this.locales[this.current], "Missing locales for:", this.current);
  }

  async load_db() {
    for (let l in this.locales) {
      this.locales[l] = await LoadJSON(`_locales/${l}/messages.json`);
    }
  }

  getMessage(key, substitutions) {
    if (this.native && this.current == this.default)
      return this.native(...arguments);

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

  let myi18n = new I18n(native);
  await myi18n.load_db();

  myi18n.setAltLocale(config.ForceAltLocale());
  console.log("Using debug locale", myi18n);

  config.Bind("ForceAltLocale", (value) => {
    console.log("Setting alternative locale:", value);
    myi18n.setAltLocale(value);
  });

  return myi18n.getMessage.bind(myi18n);
}

export const _ = await Init();
