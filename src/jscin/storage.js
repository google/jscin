// Copyright 2024 Google Inc. All Rights Reserved.
//
/**
 * @fileoverview The storage provider for JsCIN
 * @author Hung-Te Lin <hungte@gmail.com>
 */

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

// A storage provider based on chrome.storage.* like backends.
export class ChromeStorage extends Storage {
  constructor(backend=undefined) {
    if (backend === undefined) {
      backend = globalThis.chrome?.storage.local;
    }
    super(backend);
  }
  async get(key, def_val) {
    let items = await this.storage.get(key);
    return (key in items) ? items[key] : def_val;
  }
  async set(key, value) {
    return this.storage.set({[key]: value});
  }
  async remove(key) {
    return this.storage.remove(key);
  }
  async has(key) {
    return (await this.getKeys()).includes(key);
  }
  async getKeys() {
    // getKeys is available since Chrome 130.
    if (this.storage.getKeys)
      return this.storage.getKeys();
    let items = await this.storage.get(null);
    return Object.keys(items);
  }
  async getBytesInUse() {
    return this.storage.getBytesInUse();
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
