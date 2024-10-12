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
    this.debug = false;

    // Converts a chrome.input.ime KeyboardEvent.code to jscin standard key names.
    // Note this is almost identical to KeyboardEvent.key except shift states.
    // Note: key codes not listed here should be passed as-is, ex: Esc, Tab.
    // See input_api/ime_event.js for a complete list.
    this.kImeKeyCodeTable = {
      "ShiftLeft": "Shift",
      "ShiftRight": "Shift",
      "ControlLeft": "Control",
      "ControlRight": "Control",
      "AltLeft": "Alt",
      "AltRight": "Alt",
      "MetaLeft": "Meta",
      "MetaRight": "Meta",
      "Space": " ",
      "ArrowLeft": "Left",
      "ArrowUp": "Up",
      "ArrowRight": "Right",
      "ArrowDown": "Down",
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
      "KeyA": "A",
      "KeyB": "B",
      "KeyC": "C",
      "KeyD": "D",
      "KeyE": "E",
      "KeyF": "F",
      "KeyG": "G",
      "KeyH": "H",
      "KeyI": "I",
      "KeyJ": "J",
      "KeyK": "K",
      "KeyL": "L",
      "KeyM": "M",
      "KeyN": "N",
      "KeyO": "O",
      "KeyP": "P",
      "KeyQ": "Q",
      "KeyR": "R",
      "KeyS": "S",
      "KeyT": "T",
      "KeyU": "U",
      "KeyV": "V",
      "KeyW": "W",
      "KeyX": "X",
      "KeyY": "Y",
      "KeyZ": "Z",
      "Numpad0": "0",
      "Numpad1": "1",
      "Numpad2": "2",
      "Numpad3": "3",
      "Numpad4": "4",
      "Numpad5": "5",
      "Numpad6": "6",
      "Numpad7": "7",
      "Numpad8": "8",
      "Numpad9": "9",
      "NumpadMultiply": "*",
      "NumpadAdd": "+",
      "NumpadSubtract": "-",
      "NumpadDecimal": ".",
      "NumpadDivide": "/",
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
  // Utilities

  // Logging / tracing utility.
  log(...args) {
    if (!jscin.debug)
      return;
    jscin.error(...args);
  }

  error(...args) {
    if (typeof(console) == typeof(undefined)) {
      print(...args);
    } else {
      console.log('[jscin]', ...args);
    }
  }

  add_logger(logger, context) {
    let old_logger = this.log;
    this.log = (...args) => {
      // TODO(hungte) apply context for logger?
      logger(...args);
      old_logger(...args);
    }
  }

  // Gets the value from a chrome.inpue.ime.KeyboardEvent.code.
  // Very similiar to KeyboardEvent.key, without case /shift.
  get_key_val(ime_api_key_code) {
    return this.kImeKeyCodeTable[ime_api_key_code] || ime_api_key_code;
  }

  // Gets the combination of keys in one chrome.input.ime.KeyboardEvent.
  // This is the format that IM.get_accepted_keys should follow.
  // In general it's list of lower-case keys, or [Ctrl ][Alt ]<key>.
  // Space is written in ' '. Single Ctrl/Alt will be in <key> field, like
  // 'Ctrl Alt' (when 2nd key is Alt) or 'Alt Ctrl' (when 2nd key is Ctrl).
  // Note Shift is not handled here, because we can't determine if the
  // keyboard mapping is same as we expected, for [0-9] and symbols.
  get_key_description(ev) {
    let k = ev.key;
    if (ev.ctrlKey && k != 'Ctrl')
      k = 'Ctrl ' + k;
    if (ev.altKey && k != 'Alt')
      k = 'Alt ' + k;
    if (ev.metaKey && k != 'Meta')
      k = 'Meta ' + k;
    return k;
  }

  // A short cut to check Ctrl/Alt/Meta modifiers (no Shift).
  has_ctrl_alt_meta(ev) {
    return ev.ctrlKey || ev.altKey || ev.metaKey;
  }

  // Module registration
  register_module(constructor, name=constructor.name) {
    this.modules[name] = constructor;
    this.log("Registered module:", name);
  }

  get_registered_modules() {
    return Object.keys(this.modules);
  }

  register_addon(constructor, name=constructor.name) {
    this.addons.push(constructor);
    this.log("Registered addon:", name);
  }

  // Input method registration
  register_input_method(name, module_name, cname) {
    if (!(module_name in this.modules)) {
      this.log("Unknown module:", module_name);
      return false;
    }
    this.input_methods[name] = {
      'label': cname,
      'module': this.modules[module_name] };
    this.log("Registered input method: ", name);
  }

  // Un-register an input method
  unregister_input_method(name) {
    if (!(name in this.input_methods)) {
      this.log("Unknown input method: " + name);
      return false;
    }
    delete this.input_methods[name]
    this.log("Un-registered input method: ", name);
    // TODO(hungte) Remove active instances?
  }

  // Create input method instance
  create_input_method(name, context, data) {
    if (!(name in this.input_methods)) {
      this.log("Unknown input method: ", name);
      return false;
    }
    this.log("Created input method instance: ", name);
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
      this.log("install_input_method: invalid table", result[1]);
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
    this.log("install_input_method:", name, data.metadata);
    this.addTable(name, data.metadata, data.data, table_source);
    return result;
  }

  get_input_method_label(name) {
    if (!(name in this.input_methods)) {
      this.log("Unknown input method: ", name);
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
          this.log("reload_configuration: unknown module", module, name);
        module = def_module;
      }
      this.register_input_method(name, module, metadatas[name].cname);
      if (!any_im)
        any_im = name;
      count_ims++;
    }

    if (count_ims < 1) {
      this.debug = true;
      this.log("reload_configuration: No input methods available.");
    }
    if (localStorage)
      this.log("localStorage:", Object.keys(localStorage));
  }

  // Table and local storage management
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
    this.writeLocalStorage(thithis.kTableMetadataKey, table_metadata);
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
        this.log("reloaded table: ", name);
      } else {
        this.error("Parse error when reloading table: ", name);
        return false;
      }
    }
    return true;
  }

  // Platform-dependent utilities

  hasLzString() {
    return typeof(LZString) != typeof(undefined);
  }

  readLocalStorage(key, default_value) {
    if (typeof(localStorage) == typeof(undefined)) {
      localStorage = {};
    }
    let data = localStorage[key];
    if (!data) {
      return default_value;
    }
    if (data[0] == '!') {
      if (!this.hasLzString()) {
        this.error("LZ-String not available. Dropping storage key:", key);
        return default_value;
      }
      data = LZString.decompress(data.substr(1));
    }
    return JSON.parse(data);
  }

  writeLocalStorage(key, data) {
    if (typeof(localStorage) == typeof(undefined)) {
      localStorage = {};
    }
    let val = JSON.stringify(data);
    if (val.length > 100 && this.hasLzString())
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
export function trace(...args) {
  if (!jscin.debug || typeof(console) != typeof(undefined))
    return;

  let e = new Error();
  let m = e.stack.toString().match(/^.*\n.*\n.*at (.+) \((.*):(\d+):\d+\)/);
  let prefix = m[2] + ':' + m[3] + ' [' + m[1] + ']: ';

  if (typeof(console) == typeof(undefined)) {
    print(prefix, ...args);
  } else {
    jscin.log(prefix, ...args);
  }
}

