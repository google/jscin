// Copyright 2011 Google Inc. All Rights Reserved.

/**
 * @fileoverview Top level definition of JavaScript CIN
 * @author kcwu@google.com (Kuang-che Wu)
 */

/**
 * The root namespace for JsCIN.
 */

var jscin = {

  // -------------------------------------------------------------------
  // Constants
  IMKEY_ABSORB: 0x0,
  IMKEY_COMMIT: 0x1,
  IMKEY_IGNORE: 0x2,
  IMKEY_DELAY:  0x4,
  IMKEY_UNKNOWN: 0x100,

  // Configuration key names.
  kTableMetadataKey: "table_metadata",
  kTableDataKeyPrefix: "table_data-",
  kRawDataKeyPrefix: "raw_data-",
  kVersionKey: "version",
  kCrossQueryKey: "cross_query",
  kModuleNameKey: 'default_module_name',
  kDefaultModuleName: 'GenInp2',

  // Converts a chrome.input.ime KeyboardEvent.code to jscin standard key names.
  // Note this is almost identical to KeyboardEvent.key except shift states.
  // Note: key codes not listed here should be passed as-is, ex: Esc, Tab.
  // See input_api/ime_event.js for a complete list.
  kImeKeyCodeTable: {
    "ShiftLeft": "Shift",
    "ShiftRight": "Shift",
    "ControlLeft": "Control",
    "ControlRight": "Control",
    "AltLeft": "Alt",
    "AltRight": "Alt",
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
  },

  // -------------------------------------------------------------------
  // Variables
  modules: {},
  addons: [],
  input_methods: {},

  debug: false,

  // -------------------------------------------------------------------
  // Utilities

  // Logging / tracing utility.
  log: function () {
    if (!jscin.debug)
      return;
    jscin.error.apply(jscin, arguments);
  },

  error: function () {
    if (typeof(console) == typeof(undefined)) {
      print.apply(null, arguments);
    } else {
      console.log.apply(console, arguments);
    }
  },

  add_logger: function (logger, context) {
    var old_logger = jscin.log;
    jscin.log = function () {
      logger.apply(context, arguments);
      old_logger.apply(null, arguments);
    }
  },

  // Gets the value from a chrome.inpue.ime.KeyboardEvent.code.
  // Very similiar to KeyboardEvent.key, without case /shift.
  get_key_val: function (ime_api_key_code) {
    return jscin.kImeKeyCodeTable[ime_api_key_code] || ime_api_key_code;
  },

  // Gets the combination of keys in one chrome.input.ime.KeyboardEvent.
  // This is the format that IM.get_accepted_keys should follow.
  // In general it's list of lower-case keys, or [Ctrl ][Alt ]<key>.
  // Space is written in ' '. Single Ctrl/Alt will be in <key> field, like
  // 'Ctrl Alt' (when 2nd key is Alt) or 'Alt Ctrl' (when 2nd key is Ctrl).
  // Note Shift is not handled here, because we can't determine if the
  // keyboard mapping is same as we expected, for [0-9] and symbols.
  get_key_description: function (ev) {
    var k = ev.key;
    if (ev.altKey && k != 'Alt')
      k = 'Alt ' + k;
    if (ev.ctrlKey && k != 'Ctrl')
      k = 'Ctrl ' + k;
    return k;
  },

  // Module registration
  register_module: function (name, constructor) {
    var self = jscin;
    self.modules[name] = constructor;
    self.log("jscin: Registered module:", name);
  },

  get_registered_modules: function () {
    return Object.keys(jscin.modules);
  },

  register_addon: function (name, constructor) {
    var self = jscin;
    self.addons.push(constructor);
    self.log("jscin: Registered addon:", name);
  },

  // Input method registration
  register_input_method: function (name, module_name, cname) {
    var self = jscin;
    if (!(module_name in self.modules)) {
      self.log("jscin: Unknown module:", module_name);
      return false;
    }
    self.input_methods[name] = {
      'label': cname,
      'module': self.modules[module_name] };
    self.log("jscin: Registered input method: ", name);
  },

  // Un-register an input method
  unregister_input_method: function (name) {
    var self = jscin;
    if (!(name in self.input_methods)) {
      self.log("jscin: Unknown input method: " + name);
      return false;
    }
    delete self.input_methods[name]
    self.log("jscin: Un-registered input method: ", name);

    // TODO(hungte) Remove active instances?
  },

  // Create input method instance
  create_input_method: function (name, context, data) {
    var self = jscin;
    if (!(name in self.input_methods)) {
      self.log("jscin: Unknown input method: ", name);
      return false;
    }
    self.log("jscin: Created input method instance: ", name);
    var module = jscin.input_methods[name]["module"];
    if (!data)
      data = jscin.getTableData(name);
    var instance = new module(name, data);
    instance.init(context);
    self.addons.forEach(function (addon) {
      instance = new addon('addon', instance);
    });
    return instance;
  },

  get_input_method_label: function (name) {
    var self = jscin;
    if (!(name in self.input_methods)) {
      self.log("jscin: Unknown input method: ", name);
      return null;
    }
    return jscin.input_methods[name].label;
  },

  // Extends base input module (class inheritance).
  extend_input_method: function (overrides, base) {
    if (!base) {
      base = jscin.base_input_method;
      if (!base) {
        jscin.log("jscin: No base input method defined.");
        return;
      }
    }
    var im = function () {
      base.apply(this, arguments);
      if (overrides.constructor) {
        overrides.constructor.apply(this, arguments);
      }
    }
    im.prototype = Object.create(base.prototype);
    im.prototype.constructor = im;
    // TODO(hungte) Create a tiny object to stub all .super calls.
    im.prototype.super = base.prototype;
    for (var k in overrides) {
      if (k == 'constructor')
        continue;
      im.prototype[k] = overrides[k];
    }
    return im;
  },

  reload_configuration: function () {
    var self = jscin;

    // Reset input methods
    self.input_methods = {};
    var count_ims = 0;
    var any_im = '';
    var metadatas = self.getTableMetadatas();
    var def_module = self.getDefaultModuleName();
    for (var name in metadatas) {
      var module = metadatas[name].module;
      module = (module in self.modules) ? module : def_module;
      self.register_input_method(name, module, metadatas[name].cname);
      if (!any_im)
        any_im = name;
      count_ims++;
    }

    if (count_ims < 1) {
      self.debug = true;
      self.log("jscin.reload_configuration: No input methods available.");
    }
    if (localStorage)
      self.log("jscin.localStorage:", Object.keys(localStorage));
  },

  // Table and local storage management
  getCrossQuery: function () {
    return jscin.readLocalStorage(jscin.kCrossQueryKey);
  },

  setCrossQuery: function (ime) {
    return jscin.writeLocalStorage(jscin.kCrossQueryKey, ime);
  },

  getLocalStorageVersion: function () {
    return jscin.readLocalStorage(jscin.kVersionKey, 0);
  },

  setLocalStorageVersion: function (version) {
    return jscin.writeLocalStorage(jscin.kVersionKey, version);
  },

  addTable: function (name, metadata, data) {
    var table_metadata = jscin.readLocalStorage(jscin.kTableMetadataKey, {});
    metadata.ename = name;
    table_metadata[name] = metadata;
    jscin.writeLocalStorage(jscin.kTableMetadataKey, table_metadata);
    jscin.writeLocalStorage(jscin.kTableDataKeyPrefix + name, data);
  },

  getTableMetadatas: function () {
    return jscin.readLocalStorage(jscin.kTableMetadataKey, {});
  },

  getDefaultModuleName: function () {
    var name = jscin.readLocalStorage(jscin.kModuleNameKey,
                                      jscin.kDefaultModuleName);
    if (jscin.get_registered_modules().indexOf(name) < 0) {
      trace("Default module not available:", name);
      name = jscin.kDefaultModuleName;
    }
    return name;
  },

  setDefaultModuleName: function (new_value) {
    jscin.writeLocalStorage(jscin.kModuleNameKey, new_value);
  },

  getTableData: function (name) {
    return jscin.readLocalStorage(jscin.kTableDataKeyPrefix + name);
  },

  deleteTable: function (name) {
    var table_metadata = jscin.readLocalStorage(jscin.kTableMetadataKey, {});
    delete table_metadata[name];
    jscin.deleteLocalStorage(jscin.kTableDataKeyPrefix + name);
    jscin.writeLocalStorage(jscin.kTableMetadataKey, table_metadata);
  },

  reloadNonBuiltinTables: function () {
    var metadatas = jscin.getTableMetadatas();
    for (name in metadatas) {
      var table = metadatas[name];
      if (table.builtin)
        continue;

      var content = jscin.readLocalStorage(jscin.kRawDataKeyPrefix + name, "");
      var parsed_result = parseCin(content);
      if (parsed_result[0]) {
        var parsed_data = parsed_result[1];
        parsed_data.metadata.setting = table.setting;
        for (var option in table.setting.options) {
          parsed_data.data[option] = table.setting.options[option];
        }
        if (typeof table.url !== undefined) {
          parsed_data.metadata.url = table.url;
        }
        jscin.addTable(parsed_data.metadata.ename, parsed_data.metadata, parsed_data.data);
        jscin.log("jscin: Reload table: ", name);
      } else {
        jscin.error("jscin: Parse error when reloading table: ", name);
        return false;
      }
    }
    return true;
  },

  // Platform-dependent utilities

  hasLzString: function () {
    return typeof(LZString) != typeof(undefined);
  },

  readLocalStorage: function (key, default_value) {
    if (typeof(localStorage) == typeof(undefined)) {
      localStorage = {};
    }
    var data = localStorage[key];
    if (!data) {
      return default_value;
    }
    if (data[0] == '!') {
      if (!jscin.hasLzString()) {
        jscin.error("LZ-String not available. Dropping storage key:", key);
        return default_value;
      }
      data = LZString.decompress(data.substr(1));
    }
    return JSON.parse(data);
  },

  writeLocalStorage: function (key, data) {
    if (typeof(localStorage) == typeof(undefined)) {
      localStorage = {};
    }
    var val = JSON.stringify(data);
    if (val.length > 100 && jscin.hasLzString())
      val = '!' + LZString.compress(val);
    localStorage[key] = val;
  },

  deleteLocalStorage: function (key) {
    delete localStorage[key];
  },

  guid: function () {
    function s4() {
      return Math.floor((1 + Math.random()) * 0x10000)
          .toString(16).substring(1);
    }
    return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
        s4() + '-' + s4() + s4() + s4();
  }

};

//////////////////////////////////////////////////////////////////////////////
// Global debugging and unit tests

function trace() {
  if (!jscin.debug || typeof(console) != typeof(undefined))
    return;

  var e = new Error();
  var m = e.stack.toString().match(/^.*\n.*\n.*at (.+) \((.*):(\d+):\d+\)/);
  var prefix = m[2] + ':' + m[3] + ' [' + m[1] + ']: ';
  var msg = Array.prototype.slice.call(arguments);
  msg.unshift(prefix);

  if (typeof(console) == typeof(undefined)) {
    print.apply(null, msg);
  } else {
    jscin.log.apply(null, msg);
  }
}

// TODO(hungte) some place for global configuration data.
function dump_object(obj, indent) {
  if (obj == null) return 'null';
  if (typeof(obj) == 'string') return "'" + obj + "'";
  if (typeof(obj) != 'object') return obj;
  if (obj.constructor.toString().match(/array/i)) {
    return '[' + obj + ']';
  }

  var prefix = '';
  for (var i = 0; i < indent; i++) prefix += ' ';

  var s = '';
  for (var k in obj) {
    s += prefix + k + ': ' + dump_object(obj[k], indent+2) + '\n';
  }
  return s;
}

function dump_inpinfo(inpinfo) {
  return dump_object(inpinfo, 2);
}

