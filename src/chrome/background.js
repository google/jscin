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
      var ime_api = chrome.input.ime;

      // TODO(hungte) Move these stuff to input_ime/impl_ipc.js
      var ipc = new ImeEvent.ImeExtensionIPC('background');
      ipc.attach();

      // Forward UI events to IME Frame.
      // Menu is installed by page action window.
      function ForwardUiToImeFrame (event_name) {
        return function (arg) {
          ipc.send(event_name, arg);
        };
      }
      ime_api.onUiComposition.addListener(ForwardUiToImeFrame("UiComposition"));
      ime_api.onUiCandidates.addListener(ForwardUiToImeFrame("UiCandidates"));
      ime_api.onUiCandidateWindow.addListener(
          ForwardUiToImeFrame("UiCandidateWindow"));

      function ShowPageAction() {
        chrome.tabs.getSelected(null, function(tab) {
          chrome.pageAction.show(tab.id);
        });
      }

      // Send a refresh for content.js when any menu item is clicked.
      ime_api.onMenuItemActivated.addListener(function () {
        ipc.send("RefreshIME");
      });

      ime_api.onActivate.addListener(function () {
        ShowPageAction();
      });

      ime_api.onFocus.addListener(function (context) {
        // BUG: Try harder to show page action, if haven't.
        ShowPageAction();
        // Notify content.js new context results.
        ipc.send("Focus", context);
      });

      ime_api.onImplCommitText.addListener(function (contextID, text) {
        ipc.send("ImplCommitText", contextID, text);
      });

      // Route IPC events to ime_api.
      ipc.recv(function (type) {
        // Simple types that need to return directly.
        switch (type) {
          case "SnapshotIME":
            return {
              im_data: jscin.getTableData(croscin.instance.im_name),
              im_name: croscin.instance.im_name,
              imctx: croscin.instance.imctx
            };
          case "NewFocus":
            // We need to create a new context for this.
            var context = ime_api.EnterContext();
            return ime_api.dispatchEvent('Focus', context);
        }
        return ime_api.dispatchEvent.apply(null, arguments);
      });
    }
  }
});
