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
  return import(chrome.runtime.getURL(url));
}

async function LoadDefaultConfig() {
  const mod = await LoadModule("config.js");
  return new mod.Config();
}

function GetAllTextInputNodes() {
  return document.querySelectorAll(
    'input[type=text], input[type=search], input:not([type]), textarea');
}

async function StartEmulation() {
  const mod_page = await LoadModule("./ime_api/ipc/ipc_content.js");
  const mod_croscin = await LoadModule("./croscin.js");
  let ime_api = new mod_page.IpcContentIme();
  let croscin = new mod_croscin.CrOS_CIN(ime_api);
  globalThis.croscin = croscin;
  await croscin.Initialize();

  // Now, bind the text input elements.
  let nodes = GetAllTextInputNodes();
  for (let i = 0; i < nodes.length; i++) {
    ime_api.attach(nodes[i]);
  }
  if (document.activeElement)
    document.activeElement.focus();
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
}

async function Initialize () {
  // Currently we inject the content scripts to every frames so it is important
  // to early-exit if the page does not have input elements (for emulation).
  if (!GetAllTextInputNodes().length)
    return;

  // Now let's see if we need to start the emulation of IME API.
  // This should be the same as config.js, except simpler.
  chrome.storage.local.get(kEmulation, CheckEmulation);
}

// Check chrome.input.ime availability.
if (!globalThis?.chrome?.input?.ime)
  Initialize();
