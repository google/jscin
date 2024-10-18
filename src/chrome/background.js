// Copyright 2013 Google Inc. All Rights Reserved.

/**
 * @fileoverview JSCIN for Chrome Extension, background start entry.
 * @author hungte@google.com (Hung-Te Lin)
 */


import { croscin, jscin } from "./croscin.js";

/* Export jscin and croscin for IPC from options.js. */
globalThis.jscin = jscin
globalThis.croscin = croscin

async function welcome_chromeos() {
  chrome.runtime.onInstalled.addListener((event) => {
    if (event.reason != chrome.runtime.OnInstalledReason.INSTALL)
      return;

    let option_url = chrome.runtime.getURL(chrome.runtime.getManifest().options_page);
    chrome.tabs.create({ url: option_url }, function (tab) {
      console.warn("First time install - welcome!");
    });
  });
}

document.addEventListener( 'readystatechange', function() {
  if (document.readyState === 'complete') {
    croscin.instance = new croscin.IME();
    if (window.navigator.userAgent.includes(' CrOS '))
      welcome_chromeos();
  }
});
