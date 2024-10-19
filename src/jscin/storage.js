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
  }
  async get(key, def_val) {
    if (def_val && !(await this.has(key)))
      return def_val;
    return this.storage[key];
  }
  async set(key, value) {
    this.storage[key] = value;
  }
  async remove(key) {
    delete this.storage[key];
  }
  async has(key) {
    return key in this.storage;
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
  async get(key, def_val) {
    if (def_val && !(await this.has(key)))
      return def_val;

    let value = await super.get(key);
    if (this.isCompressed(value))
      value = LZString.decompress(value.substring(1));
    return JSON.parse(value);
  }
  async set(key, value) {
    let v = JSON.stringify(value);
    if (this.needCompress(v))
      v = this.prefix + LZString.compress(v);
    return super.set(key, v);
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
  async has(key) {
    // TODO switch to getKeys after Chrome 130 is widely available.
    return new Promise((resolve) => {
      return this.storage.get(null, (v)=>{
        resolve(Object.keys(v).includes(key));
      });
    });
  }
  async remove(key) {
    return this.storage.remove(key, ()=>{});
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
