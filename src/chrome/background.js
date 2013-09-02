// Copyright 2013 Google Inc. All Rights Reserved.

/**
 * @fileoverview JSCIN for Chrome Extension, background start entry.
 * @author hungte@google.com (Hung-Te Lin)
 */

document.addEventListener(
    'readystatechange',
    function() {
      if (document.readyState === 'complete') {
        croscin.instance = new croscin.IME;

        if (chrome.input.ime.isEmulation) {
          ipc = new ImeEvent.ImeExtensionIPC('background');
          ipc.attach();
          chrome.input.ime.attachImeExtensionIpc(ipc);
        }
      }
    });
