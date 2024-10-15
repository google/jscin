// Copyright 2011 Google Inc. All Rights Reserved.

/**
 * @fileoverview Top level definition of JavaScript CIN
 * @author kcwu@google.com (Kuang-che Wu)
 */

/**
 * The root namespace for JsCIN.
 */

import { parseCin } from "./cin_parser.js";
import { LZString } from "./lz-string.js";

import { AddLogger } from "./logger.js";
const {log, debug, info, warn, error, assert, trace, logger} = AddLogger("jscin");

export class JavaScriptInputMethod
{
  constructor()
  {
    // -------------------------------------------------------------------
    // Constants
    this.IMKEY_ABSORB = 0x0;
    this.IMKEY_COMMIT = 0x1;
    this.IMKEY_IGNORE = 0x2;
    this.IMKEY_DELAY  = 0x4;
    this.IMKEY_UNKNOWN = 0x100;

    // Configuration key names.
    this.kTableMetadataKey = "table_metadata";
    this.kTableDataKeyPrefix = "table_data-";
    this.kRawDataKeyPrefix = "raw_data-";
    this.kVersionKey = "version";
    this.kCrossQueryKey = "cross_query";
    this.kModuleNameKey = 'default_module_name';
    this.kDefaultModuleName = 'GenInp2';

    // -------------------------------------------------------------------
    // Variables
    this.modules = {};
    this.addons = [];
    this.input_methods = {};

    // Converts KeyboardEvent.code to KeyboardEvent.key, regardless of shift modifier.
    // This only includes en-US layout common keys that we'd usually use in CJK IMs.
    this.kUnshiftMap = {
      "Digit0": "0",
      "Digit1": "1",
      "Digit2": "2",
      "Digit3": "3",
      "Digit4": "4",
      "Digit5": "5",
      "Digit6": "6",
      "Digit7": "7",
      "Digit8": "8",
      "Digit9": "9",
      "KeyA": "a",
      "KeyB": "b",
      "KeyC": "c",
      "KeyD": "d",
      "KeyE": "e",
      "KeyF": "f",
      "KeyG": "g",
      "KeyH": "h",
      "KeyI": "i",
      "KeyJ": "j",
      "KeyK": "k",
      "KeyL": "l",
      "KeyM": "m",
      "KeyN": "n",
      "KeyO": "o",
      "KeyP": "p",
      "KeyQ": "q",
      "KeyR": "r",
      "KeyS": "s",
      "KeyT": "t",
      "KeyU": "u",
      "KeyV": "v",
      "KeyW": "w",
      "KeyX": "x",
      "KeyY": "y",
      "KeyZ": "z",
      "Semicolon": ";",
      "Equal": "=",
      "Comma": ",",
      "Minus": "-",
      "Period": ".",
      "Slash": "/",
      "BackQuote": "`",
      "BracketLeft": "[",
      "BracketRight": "]",
      "Backslash": "\\",
      "Quote": "'"
    };
  }

  // -------------------------------------------------------------------
  // KeyboardEvent utilities

  // Gets the combination of keys in one KeyboardEvent.
  // This is the format that IM.get_accepted_keys should follow.
  // In general it is list of lower-case keys, or [Ctrl-][Alt-][Meta-]<key>.
  //
  // Note Shift state already changed the 'key' value, so for addons and IMs
  // that expect to behave differently, they have to either list using the
  // shifted key values (e.g., addon_punctuations), or use the
  // get_unshifted_key() below to find the original key input (addon_related).
  get_key_description(ev) {
    let k = ev.key;
    if (ev.metaKey && k != 'Meta')
      k = 'Meta-' + k;
    if (ev.altKey && k != 'Alt')
      k = 'Alt-' + k;
    if (ev.ctrlKey && k != 'Ctrl')
      k = 'Ctrl-' + k;
    return k;
  }

  // Returns the KeyboardEvent.key regardless of ev.shiftKey state.
  get_unshifted_key(ev) {
    return this.kUnshiftMap[ev.code] || ev.key;
  }

  // A short cut to check Ctrl/Alt/Meta modifiers (no Shift).
  has_ctrl_alt_meta(ev) {
    return ev.ctrlKey || ev.altKey || ev.metaKey;
  }

  // -------------------------------------------------------------------
  // Modules, input methods and addons

  register_module(constructor, name=constructor.name) {
    this.modules[name] = constructor;
    debug("Registered module:", name);
  }

  get_registered_modules() {
    return Object.keys(this.modules);
  }

  register_addon(constructor, name=constructor.name) {
    this.addons.push(constructor);
    debug("Registered addon:", name);
  }

  register_input_method(name, module_name, cname) {
    if (!(module_name in this.modules)) {
      debug("Unknown module:", module_name);
      return false;
    }
    this.input_methods[name] = {
      'label': cname,
      'module': this.modules[module_name] };
    debug("Registered input method:", name);
  }

  unregister_input_method(name) {
    if (!(name in this.input_methods)) {
      debug("Unknown input method:", name);
      return false;
    }
    delete this.input_methods[name]
    debug("Un-registered input method:", name);
    // TODO(hungte) Remove active instances?
  }

  // Create input method instance
  create_input_method(name, context, data) {
    if (!(name in this.input_methods)) {
      debug("Unknown input method:", name);
      return false;
    }
    debug("Created input method instance:", name);
    let module = this.input_methods[name]["module"];
    if (!data)
      data = this.getTableData(name);
    let instance = new module(name, data);
    instance.init(context);
    this.addons.forEach((addon) => {
      instance = new addon('addon', instance);
    });
    return instance;
  }

  install_input_method(name, table_source, metadata) {
    // TODO(hungte) Move parseCin to jscin namespace.
    let result = parseCin(table_source);
    if (!result[0]) {
      debug("install_input_method: invalid table", result[1]);
      return result;
    }
    let data = result[1];
    name = name || data.metadata.ename;
    for (let key in metadata) {
      data.metadata[key] = metadata[key];
    }
    if (metadata.setting && metadata.setting.options) {
      for (let option in metadata.setting.options) {
        data.data[option] = metadata.setting.options[option];
      }
    }
    debug("install_input_method:", name, data.metadata);
    this.addTable(name, data.metadata, data.data, table_source);
    return result;
  }

  get_input_method_label(name) {
    if (!(name in this.input_methods)) {
      debug("Unknown input method:", name);
      return null;
    }
    return this.input_methods[name].label;
  }

  has_input_method_rawdata(name) {
    return this.isInLocalStorage(this.kRawDataKeyPrefix + name);
  }

  get_input_method_rawdata(name) {
    return this.readLocalStorage(this.kRawDataKeyPrefix + name);
  }

  // -------------------------------------------------------------------
  // Configurations

  reload_configuration() {
    // Reset input methods
    this.input_methods = {};
    let count_ims = 0;
    let any_im = '';
    let metadatas = this.getTableMetadatas();
    let def_module = this.getDefaultModuleName();
    for (let name in metadatas) {
      let module = metadatas[name].module;
      if (!(module in this.modules)) {
        if (module)
          debug("reload_configuration: unknown module", module, name);
        module = def_module;
      }
      this.register_input_method(name, module, metadatas[name].cname);
      if (!any_im)
        any_im = name;
      count_ims++;
    }

    if (count_ims < 1) {
      error("reload_configuration: No input methods available.");
    }
    if (localStorage)
      debug("localStorage:", Object.keys(localStorage));
  }

  // -------------------------------------------------------------------
  // Tables and local storage management

  getCrossQuery() {
    return this.readLocalStorage(this.kCrossQueryKey);
  }

  setCrossQuery(ime) {
    return this.writeLocalStorage(this.kCrossQueryKey, ime);
  }

  getLocalStorageVersion() {
    return this.readLocalStorage(this.kVersionKey, 0);
  }

  setLocalStorageVersion(version) {
    return this.writeLocalStorage(this.kVersionKey, version);
  }

  addTable(name, metadata, data, raw_data) {
    let table_metadata = this.readLocalStorage(this.kTableMetadataKey, {});
    metadata.ename = metadata.ename || name;
    table_metadata[name] = metadata;
    this.writeLocalStorage(this.kTableMetadataKey, table_metadata);
    this.writeLocalStorage(this.kTableDataKeyPrefix + name, data);
    if (raw_data && !metadata.builtin)
      this.writeLocalStorage(this.kRawDataKeyPrefix + name, raw_data);
  }

  getTableMetadatas() {
    return this.readLocalStorage(this.kTableMetadataKey, {});
  }

  getDefaultModuleName() {
    let name = this.readLocalStorage(this.kModuleNameKey,
                                      this.kDefaultModuleName);
    if (!this.get_registered_modules().includes(name)) {
      trace("Default module not available:", name);
      name = this.kDefaultModuleName;
    }
    return name;
  }

  setDefaultModuleName(new_value) {
    this.writeLocalStorage(this.kModuleNameKey, new_value);
  }

  getTableData(name) {
    return this.readLocalStorage(this.kTableDataKeyPrefix + name);
  }

  deleteTable(name) {
    let table_metadata = this.readLocalStorage(this.kTableMetadataKey, {});
    delete table_metadata[name];
    this.deleteLocalStorage(this.kTableDataKeyPrefix + name);
    this.deleteLocalStorage(this.kRawDataKeyPrefix + name);
    this.writeLocalStorage(this.kTableMetadataKey, table_metadata);
  }

  // Loads from LocalStorage and write into chrome.debug,
  // prepare for Manifest V3. In Chrome 130+ we may call getKeys,
  // but for now only get() is widely available.
  backupTables() {
    chrome.storage.local.get(null, (items) => {
      let keys = Object.keys(items);
      debug("backupTables - found keys in local storage:", keys);
      for (let v of Object.values(this.getTableMetadatas())) {
        if (v.builtin)
          continue;

        let name = v.ename;
        let kData = this.kTableDataKeyPrefix + name;

        if (keys.includes(kData))
          continue;
        if (!this.isInLocalStorage(kData))
          continue;

        let items = {[kData]: localStorage[kData]};
        chrome.storage.local.set(
          items, ()=>{
            debug("Backed up the table for MV3:", name);
          });
      }
    });
  }

  reloadNonBuiltinTables() {
    let metadatas = this.getTableMetadatas();
    for (name in metadatas) {
      let table = metadatas[name];
      if (table.builtin)
        continue;

      let content = this.readLocalStorage(this.kRawDataKeyPrefix + name, "");
      let result = this.install_input_method(name, content, {
        url: table.url, setting: table.setting });
      if (result[0]) {
        debug("reloaded table:", name);
      } else {
        error("Parse error when reloading table:", name);
        return false;
      }
    }
    return true;
  }

  // Platform-dependent utilities

  readLocalStorage(key, default_value) {
    if (typeof(localStorage) == typeof(undefined))
      globalThis.localStorage = {};
    let data = localStorage[key];
    if (!data)
      return default_value;
    if (data[0] == '!')
      data = LZString.decompress(data.substring(1));
    return JSON.parse(data);
  }

  writeLocalStorage(key, data) {
    if (typeof(localStorage) == typeof(undefined)) {
      localStorage = {};
    }
    let val = JSON.stringify(data);
    if (val.length > 100)
      val = '!' + LZString.compress(val);
    localStorage[key] = val;
  }

  isInLocalStorage(key) {
    if (typeof(localStorage) == typeof(undefined)) {
      localStorage = {};
    }
    return (key in localStorage);
  }

  deleteLocalStorage(key) {
    delete localStorage[key];
  }

  guid() {
    function s4() {
      return Math.floor((1 + Math.random()) * 0x10000)
          .toString(16).substring(1);
    }
    return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
        s4() + '-' + s4() + s4() + s4();
  }
}

//////////////////////////////////////////////////////////////////////////////
// Global debugging and unit tests

export var jscin = new JavaScriptInputMethod();

// In JavaScript debug console, type "jscin.loggers" to change loggers' states.
jscin.loggers = logger.getAllLoggers();

