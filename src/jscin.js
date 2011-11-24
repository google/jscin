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

  // Configuration key names.
  kTableMetadataKey: "table_metadata",
  kTableDataKeyPrefix: "table_data-",
  kDefaultCinTableKey: "default_cin_table",

  modules: {},
  input_methods: {},
  default_input_method: '',

  debug: true,
};

/**
 * Utilities
 */

// Logging / tracing utility.
jscin.log = function(s) {
  if (!jscin.debug)
    return;

  if (typeof(console) == typeof(undefined)) {
    print(s);
  } else {
    console.log(s);
  }
}

// Module registration
jscin.register_module = function(name, constructor) {
  var self = jscin;
  self.modules[name] = constructor;
  self.log("jscin: Registered module:" + name);
}

// Input method registration
jscin.register_input_method = function(name, module_name, cname) {
  var self = jscin;
  if (!(module_name in self.modules)) {
    self.log("jscin: Unknown module: " + module_name);
    return false;
  }
  self.input_methods[name] = {
    'label': cname,
    'new_instance': new self.modules[module_name](name)};
  self.log("jscin: Registered input method: " + name);

  if (!self.default_input_method)
    self.default_input_method = name;
}

// Un-register an input method
jscin.unregister_input_method = function(name) {
  var self = jscin;
  if (!(name in self.input_methods)) {
    self.log("jscin: Unknown input method: " + name);
    return false;
  }
  delete self.input_methods[name]
  self.log("jscin: Un-registered input method: " + name);

  // Reset default input method.
  if (name == self.default_input_method) {
    self.default_input_method = '';
    for (var i in self.input_methods) {
      self.default_input_method = self.input_methods[i];
      break;
    }
  }
  // TODO(hungte) Remove active instances?
}

// Create input method instance
jscin.create_input_method = function(name, context) {
  var self = jscin;
  if (!(name in self.input_methods)) {
    self.log("jscin: Unknown input method: " + name);
    return false;
  }
  self.log("jscin: Created input method instance: " + name);
  return jscin.input_methods[name]["new_instance"].new_instance(context);
}

jscin.reload_configuration = function() {
  var self = jscin;

  // Reset input methods
  self.input_methods = {};
  var count_ims = 0;
  var table_metadata = self.readLocalStorage(self.kTableMetadataKey, {});
  var any_im = '';
  for (var name in table_metadata) {
    // TODO(hungte) support more modules in future.
    self.register_input_method(name, 'GenInp', table_metadata[name].cname);
    if (!any_im)
      any_im = name;
    count_ims++;
  }

  if (count_ims < 1) {
    self.debug = true;
    self.log("jscin.reload_configuration: No input methods available.");
    self.default_input_method = '';
  } else {
    // Update default input method
    self.default_input_method = self.readLocalStorage(
        self.kDefaultCinTableKey, self.default_input_method);
    if (!(self.default_input_method in self.input_methods)) {
      self.log("jscin.reload_configuration: invalid default input method: " +
               self.default_input_method + ", picked: " + any_im);
      self.default_input_method = any_im;
    }
  }
}

//////////////////////////////////////////////////////////////////////////////
// Platform-dependent utilities

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
