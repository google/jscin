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
    'module': self.modules[module_name] };
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
  var module = jscin.input_methods[name]["module"];
  return (new module(name)).new_instance(context);
}

jscin.get_input_method_label = function(name) {
  var self = jscin;
  if (!(name in self.input_methods)) {
    self.log("jscin: Unknown input method: " + name);
    return null;
  }
  return jscin.input_methods[name]["label"];
}

jscin.reload_configuration = function() {
  var self = jscin;

  // Reset input methods
  self.input_methods = {};
  var count_ims = 0;
  var any_im = '';
  for (var name in self.getTableMetadatas()) {
    // TODO(hungte) support more modules in future.
    var metadatas = jscin.getTableMetadatas();
    self.register_input_method(name, 'GenInp', metadatas[name].cname);
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
// Table management
jscin.addTable = function (name, metadata, data) {
  // print('addTable(' + name + ',' + metadata);
  var table_metadata = jscin.readLocalStorage(jscin.kTableMetadataKey, {});
  metadata.ename = name;
  table_metadata[name] = metadata;
  jscin.writeLocalStorage(jscin.kTableMetadataKey, table_metadata);
  jscin.writeLocalStorage(jscin.kTableDataKeyPrefix + name, data);
}

jscin.getTableMetadatas = function () {
  return jscin.readLocalStorage(jscin.kTableMetadataKey, {});
}

jscin.getTableData = function (name) {
  return jscin.readLocalStorage(jscin.kTableDataKeyPrefix + name);
}

jscin.deleteTable = function (name) {
  var table_metadata = jscin.readLocalStorage(jscin.kTableMetadataKey, {});
  delete table_metadata[name];
  delete localStorage[jscin.kTableDataKeyPrefix + name];
  jscin.writeLocalStorage(jscin.kTableMetadataKey, table_metadata);
}

jscin.setDefaultCinTable = function (name) {
  jscin.writeLocalStorage(jscin.kDefaultCinTableKey, name);
}

jscin.getDefaultCinTable = function () {
  return jscin.readLocalStorage(jscin.kDefaultCinTableKey, jscin.kDefaultCinTableDefault);
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

//////////////////////////////////////////////////////////////////////////////
// Debugging and unit tests

function trace(s) {
  var e = new Error();
  var m = e.stack.toString().match(/^.*\n.*\n.*at (.+) \((.*):(\d+):\d+\)/);
  var prefix = m[2] + ':' + m[3] + ' [' + m[1] + ']: ';
  var msg = prefix + s;
  if (typeof(console) == typeof(undefined)) {
    print(msg);
  } else {
    jscin.log(msg);
  }
}

function dump_inpinfo(inpinfo) {
  return dump_object(inpinfo, 2);
}

