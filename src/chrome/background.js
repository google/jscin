// Copyright 2013 Google Inc. All Rights Reserved.

/**
 * @fileoverview JSCIN for Chrome Extension, background start entry.
 * @author hungte@google.com (Hung-Te Lin)
 */

document.addEventListener( 'readystatechange', function() {
  if (document.readyState === 'complete') {
    croscin.instance = new croscin.IME;

    // TODO Sync with content.js behavior.
    if (chrome.input.ime.isEmulation &&
        croscin.instance.prefGetSupportNonChromeOS()) {
      ipc = new ImeEvent.ImeExtensionIPC('background');
      ipc.attach();
      chrome.input.ime.attachImeExtensionIpc(ipc);
      console.log(chrome.input.ime.onUiComposition);

      // Forward UI events to IME Frame.
      // Menu is installed by page action window.
      function ForwardUiToImeFrame (event_name) {
        return function (arg) {
          ipc.send(event_name, arg);
        };
      }

      chrome.input.ime.onUiComposition.addListener(
          ForwardUiToImeFrame("UiComposition"));
      chrome.input.ime.onUiCandidateWindow.addListener(
          ForwardUiToImeFrame("UiCandidateWindow"));
      chrome.input.ime.onUiCandidates.addListener(
          ForwardUiToImeFrame("UiCandidates"));
    }
  }
});
