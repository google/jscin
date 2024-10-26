// Copyright 2013 Google Inc. All Rights Reserved.

/**
 * @fileoverview JSCIN for Chrome Extension, background start entry.
 * @author hungte@google.com (Hung-Te Lin)
 */


import { croscin } from "./croscin.js";

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

croscin.instance = new croscin.IME();
if (globalThis.window && window.navigator.userAgent.includes(' CrOS '))
  welcome_chromeos();

/* Export jscin and croscin for debugging.  */
globalThis.croscin = croscin

console.log("ChromeOS Extension for JavaScript Chinese Input Method.\n\n",
            "To debug, explore `croscin`.\n",
            "To turn on/off debug messages of each component,",
            "change the `verbose` property from command:\n\n",
            "  croscin.logger.getAllLoggers() \n\n",
            "To turn on all components, do:\n\n",
            "  croscin.logger.enableAllLoggers() \n\n");
