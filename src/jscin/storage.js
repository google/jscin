// Copyright 2024 Google Inc. All Rights Reserved.
//
/**
 * @fileoverview The storage provider for JsCIN
 * @author Hung-Te Lin <hungte@gmail.com>
 */

import { LZString } from "./lz-string.js";
import { AddLogger } from "./logger.js";
const {log, debug, info, warn, error, assert, trace} = AddLogger("storage");

// A general asynchronous storage provider.
export class Storage {
  constructor(backend=undefined) {
    if (backend === undefined) {
      backend = globalThis.localStorage || {};
    }
    this.storage = backend;
    this.callbacks = [];
  }
  async get(key, def_val) {
    if (def_val && !(await this.has(key)))
      return def_val;
    return this.storage[key];
  }
  async set(key, value) {
    let changes = {newValue: value};
    if (key in this.storage) {
      changes.oldValue = this.storage[key];
    }
    this.storage[key] = value;
    this.onChanged({[key]: changes});
  }
  async remove(key) {
    let v = this.storage[key];
    delete this.storage[key];
    this.onChanged({[key]: {oldValue: v}});
  }
  async has(key) {
    return key in this.storage;
  }
  async getKeys() {
    return Object.keys(this.storage);
  }
  async getBytesInUse() {
    return JSON.stringify(this.storage).length;
  }
  listen(callback) {
    this.callbacks.push(callback);
  }
  onChanged(changes, namespace) {
    if (!this.callbacks.length)
      return;
    debug("onChanged:", changes, "namespace:", namespace);
    // namespace may be undefined.
    if ((namespace && namespace != 'local'))
      return;
    for (let c of this.callbacks)
      c(changes);
  }
}

// A storage provider based on localStorage with compression
export class CompressedStorage extends Storage {
  constructor(backend=undefined) {
    super(backend);
    this.prefix = '!';
  }
  isCompressed(value) {
    return value.startsWith(this.prefix);
  }
  needCompress(value) {
    return value.startsWith(this.prefix) || value.length >= 100;
  }
  getReturnValue(value) {
    if (!value)
      return value;
    if (this.isCompressed(value))
      value = LZString.decompress(value.substring(1));
    return JSON.parse(value);
  }
  async get(key, def_val) {
    // def_val can't be decompressed so we have to handle it first.
    if (def_val && !(await this.has(key)))
      return def_val;

    return this.getReturnValue(await super.get(key));
  }
  async set(key, value) {
    let v = JSON.stringify(value);
    if (this.needCompress(v))
      v = this.prefix + LZString.compress(v);
    return super.set(key, v);
  }
  onChanged(changes, namespace) {
    for (let k in changes) {
      for (let t of ["newValue", "oldValue"]) {
        if (t in changes[k]) {
          changes[k][t] = this.getReturnValue(changes[k][t]);
        }
      }
    }
    debug("CompressedStorage: changes are:", changes);
    super.onChanged(changes, namespace);
  }
}

// A storage provider based on chrome.storage.* like backends.
export class ChromeStorage extends Storage {
  constructor(backend=undefined) {
    if (backend === undefined) {
      backend = globalThis.chrome?.storage.local;
    }
    super(backend);
  }
  async get(key, def_val) {
    // TODO Rewrite to directly return after MV3.
    return new Promise((resolve) => {
      this.storage.get(key, (items) => {
        if (key in items)
          resolve(items[key]);
        else
          resolve(def_val);
      });
  });
  }
  async set(key, value) {
    // TODO Rewrite to directly return after MV3.
    return new Promise((resolve) => {
      return this.storage.set({[key]: value}, () =>{
        resolve();
      });
    });
  }
  async remove(key) {
    return this.storage.remove(key, ()=>{});
  }
  async has(key) {
    return (await this.getKeys()).includes(key);
  }
  async getKeys() {
    // TODO switch to getKeys after Chrome 130 is widely available.
    return new Promise((resolve) => {
      this.storage.get(null, (items) => {
        resolve(Object.keys(items));
      });
    });
  }
  async getBytesInUse() {
    return new Promise((resolve) => {
      this.storage.getBytesInUse((num) => {
        resolve(num);
      });
    });
  }
  listen(callback) {
    if (!this.callbacks.length && this.storage.onChanged) {
      this.storage.onChanged.addListener(this.onChanged.bind(this));
    }
    super.listen(callback);
  }
}

export async function LoadResource(url) {
  let fetcher = fetch;
  if (!url.includes('://')) {
    if (globalThis.chrome && chrome.runtime) {
      // Chrome browser (extension only)
      url = chrome.runtime.getURL(url);
    } else {
      // Node.js
      fetcher = (await import("file-fetch")).default;
    }
  }

  debug("LoadResource:", url);
  try {
    const response = await fetcher(url);
    if (!response.ok) {
      trace("LoadResource: response is not OK:", url, response.status);
      return;
    }
    return response;
  } catch (err) {
    trace("LoadResource: caught error:", err);
  }
  return;
}

export async function LoadText(url) {
  return (await LoadResource(url))?.text();
}
export async function LoadJSON(url) {
  return (await LoadResource(url))?.json();
}

async function response2Blob(response) {
  if (!response)
    return response;
  if (response.blob)
    return response.blob();
  return new Blob([await response.text()], {type: 'plain/text'});
}

export async function LoadBlob(url) {
  // node.js file-fetch does not support blob().
  return response2Blob(await LoadResource(url));
}
export async function LoadArrayBuffer(url) {
  // node.js file-fetch does not support arrayBuffer().
  let response = await LoadResource(url);
  if (!response)
    return response;
  if (response.arrayBuffer)
    return response.arrayBuffer();
  return (await response2Blob(response)).arrayBuffer();
}
