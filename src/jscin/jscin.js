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
import { applyInputMethodTableQuirks } from './quirks.js';

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
    this.kModuleNameKey = 'default_module_name';
    this.kDefaultModuleName = 'GenInp2';

    // -------------------------------------------------------------------
    // Variables
    this.modules = {};
    this.addons = [];
    this.input_methods = {};
  }

  // -------------------------------------------------------------------
  // Modules, input methods and addons

  registerModule(constructor, name=constructor.name) {
    this.modules[name] = constructor;
    debug("Registered module:", name);
  }

  getModuleNames() {
    return Object.keys(this.modules);
  }

  registerAddon(constructor, name=constructor.name) {
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
  activateInputMethod(name, context, data) {
    if (!(name in this.input_methods)) {
      debug("Unknown input method:", name);
      return false;
    }
    debug("Created input method instance:", name);
    let module = this.input_methods[name]["module"];
    if (!data)
      data = this.loadTable(name);
    if (!data) {
      debug("Invalid table:", name);
      return false;
    }
    applyInputMethodTableQuirks(data);
    let instance = new module(name, data);
    instance.init(context);
    for (let addon of this.addons) {
      instance = new addon('addon', instance);
    }
    return instance;
  }

  saveTable(name, table_source, metadata) {
    // TODO(hungte) Move parseCin to jscin namespace.
    let [success, result] = parseCin(table_source);
    if (!success) {
      debug("saveTable: invalid table", result);
      return result;
    }
    name = name || result.metadata.ename;
    for (let key in metadata) {
      result.metadata[key] = metadata[key];
    }
    if (metadata.setting && metadata.setting.options) {
      for (let option in metadata.setting.options) {
        result.data[option] = metadata.setting.options[option];
      }
    }
    debug("saveTable:", name, result.metadata);
    this.addTable(name, result.metadata, result.data, table_source);
    return [success, result];
  }

  getTableInfo(name) {
    return this.getTableMetadatas()[name];
  }

  getLabel(name) {
    if (!(name in this.input_methods)) {
      debug("Unknown input method:", name);
      return null;
    }
    return this.input_methods[name].label;
  }

  getTableNames() {
    return Object.keys(this.getTableMetadatas());
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

  addTable(name, metadata, data, raw_data) {
    let table_metadata = this.readLocalStorage(this.kTableMetadataKey, {});
    metadata.ename = metadata.ename || name;
    table_metadata[name] = metadata;
    this.writeLocalStorage(this.kTableMetadataKey, table_metadata);
    this.writeLocalStorage(this.kTableDataKeyPrefix + name, data);
  }

  getTableMetadatas() {
    return this.readLocalStorage(this.kTableMetadataKey, {});
  }

  getDefaultModuleName() {
    let name = this.readLocalStorage(this.kModuleNameKey,
                                      this.kDefaultModuleName);
    if (!name)
      name = this.kDefaultModuleName;

    let modules = this.getModuleNames();
    if (!modules.includes(name)) {
      let first = modules[0];
      debug("Default module not avaialble and fallback to the 1st registered:",
            name, "=>", first);
      name = first;
    }
    return name;
  }

  setDefaultModuleName(new_value) {
    this.writeLocalStorage(this.kModuleNameKey, new_value);
  }

  loadTable(name) {
    return this.readLocalStorage(this.kTableDataKeyPrefix + name);
  }

  removeTable(name) {
    let table_metadata = this.readLocalStorage(this.kTableMetadataKey, {});
    delete table_metadata[name];
    this.deleteLocalStorage(this.kTableDataKeyPrefix + name);
    this.writeLocalStorage(this.kTableMetadataKey, table_metadata);
  }

  async deleteRawData() {
    const kRawDataKeyPrefix = "raw_data-";
    for (let k in localStorage) {
      if (!k.startsWith(kRawDataKeyPrefix))
        continue;
      delete localStorage[k];
      log("Removed raw table", k);
    }
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

  deleteLocalStorage(key) {
    delete localStorage[key];
  }
}

//////////////////////////////////////////////////////////////////////////////
// Global debugging and unit tests

export var jscin = new JavaScriptInputMethod();

// In JavaScript debug console, type "jscin.loggers" to change loggers' states.
jscin.loggers = logger.getAllLoggers();

