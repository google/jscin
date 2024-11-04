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

async function StartEmulation() {
  const mod_page = await LoadModule("./emulation/iframe/content.js");
  const mod_croscin = await LoadModule("./croscin.js");
  let ime = new mod_page.IFrameIme();
  let croscin = mod_croscin.croscin;
  let instance = new croscin.IME(ime);
  croscin.instance = instance;
  await instance.Initialize();

  // Register for debugging in the console.
  globalThis.croscin = croscin;
  globalThis.ime = ime;

  // Now, bind the input elements.
  let nodes = document.getElementsByTagName("input");
  for (let i = 0; i < nodes.length; i++) {
    ime.attach(nodes[i]);
  }
  nodes = document.getElementsByTagName("textarea");
  for (let i = 0; i < nodes.length; i++) {
    ime.attach(nodes[i]);
  }
  if (document.activeElement)
    document.activeElement.focus();

  // TODO(hungte) show/hide the frame
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
  // Check chrome.input.ime availability.  The correct way is to check
  // chrome.input.ime binding but that would spew error message in console for
  // every page; so let's check userAgent instead because for right now only
  // ChromeOS supports that.
  if (window.navigator.userAgent.includes(' CrOS '))
    return;

  // Currently we inject the content scripts to every frames so it is important
  // to early-exit if the page does not have input elements (for emulation).
  if (document.getElementsByTagName("input").length == 0 &&
      document.getElementsByTagName("textarea").length == 0)
    return;

  // Now let's see if we need to start the emulation.
  // This should be the same as config.js, except simpler.
  chrome.storage.local.get(kEmulation, CheckEmulation);
}

Initialize();
