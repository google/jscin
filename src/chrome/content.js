// Copyright 2013 Google Inc. All Rights Reserved.

/**
 * @fileoverview JSCIN for Chrome Extension, content script.
 * @author hungte@google.com (Hung-Te Lin)
 *
 * To prevent performance issues, this script should
 * - Only load modules dynamically when needed.
 * - Minimize the usage on execution time and memory.
 */

function CreateImeFrame () {
  var frame = document.createElement("iframe");
  var frameURL = chrome.runtime.getURL('emulation/ui.html');
  frame.setAttribute("src", frameURL);
  frame.setAttribute("scrolling", "no");
  frame.setAttribute("frameBorder", 0);
  frame.setAttribute("allowTransparency", true);
  frame.style.zIndex = 999999;
  frame.style.border = 0;
  frame.style.padding = 0;
  frame.style.width = "32em";
  frame.style.height = "11em";
  frame.style.position = "absolute";
  frame.style.backgroundColor = "transparent";
  frame.style.display = "none";
  var ref = document.getElementsByTagName('body')[0] || document.children[0];
  ref.appendChild(frame);
  return frame;
}

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
  const src = chrome.runtime.getURL("emulation/impl_chromeext.js");
  const mod = await import(src);
  return new mod.ChromeInputImeExtensionContent(CreateImeFrame);
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
