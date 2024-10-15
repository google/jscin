// Copyright 2013 Google Inc. All Rights Reserved.

/**
 * @fileoverview JSCIN for Chrome Extension, background start entry.
 * @author hungte@google.com (Hung-Te Lin)
 */


import { croscin, jscin } from "./croscin.js";
import { ChromeInputImeExtensionBackground } from "./emulation/impl_chromeext.js";

/* OAuth (for Google Drive) must be routed from background page. */
import { oauth } from "./oauth/oauth.js";

/* Export jscin and croscin for IPC from options.js. */
globalThis.jscin = jscin
globalThis.croscin = croscin
globalThis.oauth = oauth;

/* Decide if we want to enable Google Drive features or not. */
globalThis.enable_google_drive = false;

document.addEventListener( 'readystatechange', function() {
  if (document.readyState === 'complete') {
    croscin.instance = new croscin.IME();
    var ime = croscin.instance.ime_api;

    // TODO Sync with content.js behavior.
    if (ime.isEmulation) {
      var impl = new ChromeInputImeExtensionBackground(ime);
    }
  }
});
