// Copyright 2013 Google Inc. All Rights Reserved.

/**
 * @fileoverview JSCIN for Chrome Extension, background start entry.
 * @author hungte@google.com (Hung-Te Lin)
 */


import { CrOS_CIN } from "./croscin.js";

async function welcome_chromeos() {
  if (!chrome?.input?.ime)
    return;

  chrome.runtime.onInstalled.addListener((event) => {
    if (event.reason != chrome.runtime.OnInstalledReason.INSTALL)
      return;
    chrome.runtime.openOptionsPage();
  });
}


globalThis.croscin = new CrOS_CIN();
globalThis.jscin = croscin.jscin;

croscin.Initialize().then(() => {
    welcome_chromeos();
});

console.log("ChromeOS Extension for JavaScript Chinese Input Method.\n\n",
            "To debug, explore `croscin` and `jscin`.\n",
            "To turn on debug messages of all components, do:\n\n",
            "  croscin.logger.enableAllLoggers() \n\n");
