// Copyright 2013 Google Inc. All Rights Reserved.

/**
 * @fileoverview JSCIN for Chrome Extension, content script.
 * @author hungte@google.com (Hung-Te Lin)
 *
 * To prevent performance issues, this script should
 * - Only load modules dynamically when needed.
 * - Minimize the usage on execution time and memory.
 */

const kEmulation = "Emulation";

async function LoadModule(url) {
  const src = chrome.runtime.getURL(url);
  const mod = await import(src);
  return mod;
}

async function LoadDefaultConfig() {
  const mod = await LoadModule("config.js");
  return new mod.Config();
}

async function StartEmulation() {
  const src = chrome.runtime.getURL("emulation/ipc_content.js");
  const mod = await import(src);
  return new mod.ContentIPCHost(window);
}

async function CheckEmulation(items) {
  let result = items[kEmulation];

  if (!(kEmulation in items)) {
    let config = await LoadDefaultConfig();
    result = config.Get(kEmulation);
    // If first time, save with the default values.
    config.Save(kEmulation);
  }

  if (result)
    StartEmulation();
  // console.log("Execution time:", performance.now() - start);
}

async function Initialize () {
  // Check chrome.input.ime availability.  The correct way is to check
  // chrome.input.ime binding but that would spew error message in console for
  // every page; so let's check userAgent instead because for right now only
  // ChromeOS supports that.
  if (window.navigator.userAgent.includes(' CrOS '))
    return;

  // Now let's see if we need to start the emulation.
  // This should be the same as config.js, except simpler.
  chrome.storage.local.get(kEmulation, CheckEmulation);
}

const start = performance.now();
Initialize();
