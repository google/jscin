// Copyright 2024 Google Inc. All Rights Reserved.

/**
 * @fileoverview Configuration for JsCin Chrome Extension.
 * @author hungte@gmail.com (Hung-Te Lin)
 */

/*
 * The config was intended to be loaded in the content script and many places
 * with minimal dependency so we are NOT loading the logger.js.
 */
var verbose = false;
var assert = console.assert;

function log(...args) {
  console.log("[config]", ...args);
}
function warn(...args) {
  console.warn("[config", ...args);
}
function debug(...args) {
  if (!verbose)
    return;
  log(...args);
}

export class Config {
  constructor(backend=undefined) {
    let storage;
    if (backend) {
      // Must be debugging!
      storage = new backend(this.onChanged.bind(this));
      verbose = true;
    } else {
      // Try chrome.storage.local
      if (globalThis.chrome && chrome.storage && chrome.storage.local) {
        storage = chrome.storage.local;
        storage.onChanged.addListener(this.onChanged.bind(this));
      }
    }

    if (!storage) {
      console.error("ERROR: Config: no available backend provided (and no chrome.storage).");
    }

    this.storage = storage;
    this.config = {};
    this.callbacks = {};
    this.Reset();
    for (let prop in this.config) {
      this.callbacks[prop] = []
    }
    // Can't load now - we should wait for Bind() to finish then Load() to
    // trigger the callbacks.
  }
  Reset() {
    // Keep configs a simple structure for shallow copy.
    this.config = {
      // Version should be load and set explicitly.
      Version: 'unknown',
      Debug: false,
      DefaultModule: '',
      Emulation: false,
      AddonRelatedText: false,
      AddonPunctuations: true,
      AddonCrossQuery: "",
      InputMethods: [],
    };
  }
  onChanged(changes, namespace) {
    debug("onChanged:", changes, "namespace:", namespace);
    // namespace may be undefined.
    if ((namespace && namespace != 'local'))
      return;
    let applies = {};
    for (let k in changes) {
      // chrome.storage.onChanged listens to all changs, even outside the scope
      // of Config, so we have to skip changes not in the known list.
      if (!(k in this.config)) {
        debug("Not a config property:", k);
        continue;
      }
      /* Currently we only want to apply the "new" value.
       * Delete (only oldValue and no newValue) won't be applied.
       */
      if (!('newValue' in changes[k]))
        continue;
      let v = changes[k].newValue;
      this.config[k] = v;
      applies[k] = v;
    }
    debug("onChanged (filtered):", applies);
    this.Apply(applies);
  }
  forEach(c) {
    for (let [k, v] of Object.entries(this.config)) {
      c(k, v);
    }
  }

  CheckProperties(props) {
    if (!props)
      return;
    for (let k of props) {
      assert(k in this.config, "CheckProperties: Unkonwn property:", k);
    }
  }
  async Save(props=null) {
    if (typeof(props) === typeof('string'))
      props = [props];
    this.CheckProperties(props);
    // This would trigger the onChanged event to happen.
    // Manifest v3 provides a Promise but v2 does not.
    return new Promise((resolve, reject) => {
      let data = props ?
        Object.fromEntries(
          props.map((key, index) => [key, this.config[key]])) :
        this.config;
      debug("Save:", data);
      this.storage.set(data, ()=>{resolve();});
    });
  }
  async Load(props=null) {
    if (typeof(props) === typeof('string'))
      props = [props];
    // when props is null, storage.get() will return the whole storage.
    if (props === null)
      props = Object.keys(this.config);
    this.CheckProperties(props);
    // Manifest v3 provides a Promise but v2 does not.
    return new Promise((resolve, reject) => {
      this.storage.get(props, (data) => {

        /* Migration check from pre-chrome.storage */
        let migrateProp = (new_key, old_key) => {
          if (props.includes(new_key) && !(new_key in data)) {
            // Probably the first time to migrate.
            // Let's look at localStorage.
            let old_value = localStorage[old_key];
            // > 100 we'll need lz-string, and that's not worthy.
            if (old_value && old_value.length < 100) {
              data[new_key] = JSON.parse(old_value);
            }
          }
        }

        // In manifest V3, we can't migrate this.
        if (globalThis.localStorage) {
          migrateProp('InputMethods', 'croscinPrefEnabledInputMethodList');
          /* Migrate from < 2.90 where Version lives only in localStorage */
          migrateProp('Version', 'version');
        }

        Object.assign(this.config, data);
        debug("Load: query:", props, "storage:", data, "live:", this.config);
        this.Apply(data);
        resolve(data);
      })});
  }
  Apply(changes) {
    for (let prop in changes) {
      for (let callback of this.callbacks[prop]) {
        debug("Invoke callback:", prop, "=", changes[prop], callback);
        callback(changes[prop]);
      }
    }
  }
  Bind(prop, callback) {
    assert(prop in this.callbacks, "Unknown property", prop);
    this.callbacks[prop].push(callback);
    debug("Bound a new callback:", prop, callback);
    return this;
  }
  Get(prop) {
    assert(prop in this.config, "Unknown property", prop);
    return this.config[prop];
  }
  async Set(prop, value, partial_update=true) {
    assert(prop in this.config, "Unknown property", prop);
    assert(typeof(value) === typeof(this.config[prop]),
      "Invalid property value:", prop, typeof(value), typeof(this.config[prop]));
    this.config[prop] = value;
    return this.Save(partial_update ? prop : undefined);
  }

  // Easy Getters (do not allow setting).
  Debug()               { return this.Get("Debug"); }
  DefaultModule()       { return this.Get("DefaultModule"); }
  Emulation()           { return this.Get("Emulation"); }
  Version()             { return this.Get("Version"); }
  AddonRelatedText()    { return this.Get("AddonRelatedText"); }
  AddonPunctuations()   { return this.Get("AddonPunctuations"); }
  AddonCrossQuery()     { return this.Get("AddonCrossQuery"); }
  InputMethods()        { return this.Get("InputMethods"); }
  DefaultInputMethod()  {
    let ims = this.InputMethods();
    return (ims.length > 0) ? ims[0] : '';
  }

  // Helpers
  InsertInputMethod(name) {
    if (this.InputMethods().includes(name))
      return;
    this.Set("InputMethods",
      [name, ...this.InputMethods()]);
  }
  RemoveInputMethod(name) {
    let list = this.InputMethods();
    if (!list.includes(name)) {
      warn("RemoveInputMethod: does not exist:", name);
      return;
    }
    list.splice(list.indexOf(name), 1);
    this.Set("InputMethods", list);
  }
}
