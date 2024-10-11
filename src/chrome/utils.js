// Copyright 2024 Google Inc. All Rights Reserved.

/**
 * @fileoverview Common utilities for JsCin Chrome Extension.
 * @author hungte@gmail.com (Hung-Te Lin)
 */

/* internal variables are lowe_cased. */

const is_manifest_v3 = false;

/* Primitive functions and variables are lower cased. */

export var debug = true;

export function log(...args) {
  if (!debug)
    return;
  console.log("[utils]", ...args);
}

/* Key names are in kCamelCase. */

/* Should we enable the emulation mode (on nonCrOS platforms). */
export const kEmulation = "emulation";

/* Advanced functions and CamelCased. */

export async function LoadResource(url) {
  if (url.indexOf('://') < 0)
    url = chrome.runtime.getURL(url);
  log("LoadResource:", url);

  try {
    const response = await fetch(url);
    if (!response.ok)
      self.log("LoadResource: response is NOT ok.");

    const json = await response.text();
    return json;
  } catch (error) {
    self.log("LoadResource: caught error:", error);
  }
  return undefined;
}

export async function SetStorage(items) {
  // TODO: simplify when manifest v3 (chrome.storage will return a promise)
  let promise = new Promise((resolve, reject) => {
    chrome.storage.local.set(items, () => {
      let err = chrome.runtime.lastError;
      if (err) {
	reject(err);
      } else {
	resolve();
      }
    });
  });
  await promise;
  log("SetStorage:", items);
  return;
}

export async function GetStorage(keys) {
  // TODO: simplify when manifest v3 (chrome.storage will return a promise)
  let promise = new Promise((resolve, reject) => {
    chrome.storage.local.get(keys, (items) => {
      let err = chrome.runtime.lastError;
      if (err) {
	reject(err);
      } else {
	resolve(items);
      }
    });
  });
  let values = await promise;
  log("GetStorage:", values);
  return values;
}

export async function SetStorageItem(key, value) {
  // TODO: ES6: {[kEmulation, Boolean(flag)]}.
  let items = {};
  items[key] = Boolean(value);
  return SetStorage(items);
}

export async function GetStorageItem(key) {
  let values;
  values = await GetStorage(key);
  return values[key];
}

export async function SetEmulation(flag) {
  return SetStorageItem(kEmulation, Boolean(flag));
}

export async function GetEmulation() {
  return GetStorageItem(kEmulation);
}
