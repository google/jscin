// Copyright 2013 Google Inc. All Rights Reserved.

/**
 * @fileoverview JSCIN for Chrome Extension, background start entry.
 * @author hungte@google.com (Hung-Te Lin)
 */


import { croscin, jscin } from "./croscin.js";
import { ChromeInputImeImplChromeExtension } from "./input_api/impl_chromeext.js";

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

    // TODO Sync with content.js behavior.
    if (croscin.instance.ime_api.isEmulation) {
      var impl = new ChromeInputImeImplChromeExtension('background');
      impl.init();
    }
  }
});
