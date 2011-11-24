// Copyright 2011 Google Inc. All Rights Reserved.

/**
 * @fileoverview Top level definition of JavaScript CIN
 * @author kcwu@google.com (Kuang-che Wu)
 */

/**
 * The root namespace with constants
 */

var jscin = {
  'ENGINE_ID': "cros_cin",

  'IMKEY_ABSORB': 0x0,
  'IMKEY_COMMIT': 0x1,
  'IMKEY_IGNORE': 0x2,

  'MCCH_ONEPG': 0,
  'MCCH_BEGIN': 1,
  'MCCH_MIDDLE': 2,
  'MCCH_END': 3,

  modules: {},
  input_methods: {},

  default_input_method: '',
};

/**
 * Utilities
 */

// Logging / tracing utility.
jscin.log = function(s) {
  if (typeof(console) == typeof(undefined)) {
    print(s);
  } else {
    console.log(s);
  }
}

// Module registration
jscin.register_module = function(name, constructor) {
  jscin.modules[name] = constructor;
  jscin.log("jscin: Registered module:" + name);
}

// Input method registration
jscin.register_input_method = function(name, module_name, cname) {
  if (!(module_name in jscin.modules)) {
    jscin.log("jscin: Unknown module: " + module_name);
    return false;
  }
  jscin.input_methods[name] = {
    'label': cname,
    'new_instance': new jscin.modules[module_name](name)};
  jscin.log("jscin: Registered input method: " + name);

  if (!jscin.default_input_method)
    jscin.default_input_method = name;
}

jscin.set_default_input_method = function(name) {
  jscin.default_input_method = name;
}

// Create input method instance
jscin.create_input_method = function(name, context) {
  if (!(name in jscin.input_methods)) {
    jscin.log("jscin: Unknown input method: " + name);
    return false;
  }
  jscin.log("jscin: Created input Method instance: " + name);
  return jscin.input_methods[name]["new_instance"].new_instance(context);
}

jscin.on_config_changed = function() {
  // TODO
}

jscin.readLocalStorage = function (key, default_value) {
  if (typeof(localStorage) == typeof(undefined)) {
    localStorage = {};
  }
  var data = localStorage[key];
  if (!data) {
    return default_value;
  }
  return JSON.parse(data);
}

jscin.writeLocalStorage = function (key, data) {
  if (typeof(localStorage) == typeof(undefined)) {
    localStorage = {};
  }
  localStorage[key] = JSON.stringify(data);
}

// TODO(hungte) some place for global configuration data.
