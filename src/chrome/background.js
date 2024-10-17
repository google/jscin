// Copyright 2013 Google Inc. All Rights Reserved.

/**
 * @fileoverview JSCIN for Chrome Extension, background start entry.
 * @author hungte@google.com (Hung-Te Lin)
 */


import { croscin, jscin } from "./croscin.js";

/* Export jscin and croscin for IPC from options.js. */
globalThis.jscin = jscin
globalThis.croscin = croscin

document.addEventListener( 'readystatechange', function() {
  if (document.readyState === 'complete') {
    croscin.instance = new croscin.IME();
  }
});
