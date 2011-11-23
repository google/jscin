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

  default_im = '',
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
jscin.register_input_method = function(name, module_name, config) {
  if (!(module_name in jscin.modules)) {
    jscin.log("jscin: Unknown module: " + module_name);
    return false;
  }
  jscin.input_methods[name] = (
      new jscin.modules[module_name](name, config));
  jscin.log("jscin: Registered Input Method: " + name);
  if (!jscin.default_im)
    jscin.default_im = name;
}

// Create input method instance
jscin.create_input_method = function(name, context) {
  if (!(name in jscin.input_methods)) {
    jscin.log("jscin: Unknown input method: " + name);
    return false;
  }
  return jscin.input_methods[name].new_instance(context);
}