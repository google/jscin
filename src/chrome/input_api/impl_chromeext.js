// Copyright 2013 Google Inc. All Rights Reserved.

/**
 * @fileoverview Implementation bindings for attaching to Chrome Extension.
 * @author hungte@google.com (Hung-Te Lin)
 */

var ChromeInputImeImplChromeExtension = function () {
  var self = this;
  var ime_api = chrome.input.ime;
  var engineID = "chrome_input_ime#impl#chromeext";

  self.debug = false;
  self.log = function () {
    if (!self.debug)
      return;
    console.log.apply(console, arguments);
  }

  function ShowPageAction() {
    chrome.tabs.getSelected(null, function(tab) {
      chrome.pageAction.show(tab.id);
    });
  }

  function InitBackground() {
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

    // Send a refresh for content.js when any menu item is clicked.
    ime_api.onMenuItemActivated.addListener(function () {
      ipc.send("IpcRefreshIME");
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
        case "IpcSnapshotIME":
          return {
            im_data: jscin.getTableData(croscin.instance.im_name),
            im_name: croscin.instance.im_name,
            imctx: croscin.instance.imctx
          };
        case "IpcNewFocus":
          // We need to create a new context for this.
          return ime_api.dispatchEvent('Focus', ime_api.EnterContext());

        case 'IpcGetDefaultEnabled':
          return croscin.instance.prefGetDefaultEnabled();

        case 'IpcSetDefaultEnabled':
          self.log("IpcSetDefaultEnabled", arguments[1]);
          return croscin.instance.prefSetDefaultEnabled(arguments[1]);
      }
      return ime_api.dispatchEvent.apply(null, arguments);
    });
  }

  function InitContent() {
    var ipc = new ImeEvent.ImeExtensionIPC('content');
    ipc.attach();
    ipc.recv(self.ImeEventHandler);
  }

  self.init = function (type) {
    switch (type) {
      case 'background':
        return InitBackground();
      case 'content':
        return InitContent();
      default:
        self.log("ERROR: unknown type:", type);
        break;
    }
  };

  self.attach = function () {
    // Currently attach is done inside content.js.
  };

  return self;
};
