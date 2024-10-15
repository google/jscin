// Copyright 2013 Google Inc. All Rights Reserved.

/**
 * @fileoverview IPC Based Emulation - Background Host.
 * @author hungte@google.com (Hung-Te Lin)
 */

import { AddLogger } from "../jscin/logger.js";
const {log, debug, info, warn, error, assert, trace, logger} = AddLogger("ipc_background");

import { ImeExtensionIPC } from "./ipc.js";

export class BackgroundIPCHost {

  constructor(ime_api) {

    this.ime_api = ime_api;

    let ipc = new ImeExtensionIPC('background');
    this.ipc = ipc;
    ipc.attach();

    this.StartListeners();
  }

  attach() {
    debug("Nothing to attach in background.");
  }

  ShowPageAction() {
    chrome.tabs.getSelected(null, (tab) => { chrome.pageAction.show(tab.id); });
  }

  StartListeners() {
    let ime_api = this.ime_api;

    // Setup menu
    ime_api.onActivate.addListener(() =>                { this.ShowPageAction();});

    // Forward UI events to IME Frame.
    // Menu is installed by page action window.
    ime_api.onUiComposition.addListener((arg) =>        { this.ipc.send("UiComposition", arg); });
    ime_api.onUiCandidates.addListener((arg) =>         { this.ipc.send("UiCandidates", arg); });
    ime_api.onUiCandidateWindow.addListener((arg) =>    { this.ipc.send("UiCandidateWindow", arg); });
    ime_api.onBlur.addListener((contextID) =>           { this.ipc.send("Blur", contextID); });
    ime_api.onImplAcceptedKeys.addListener((keys) =>    { this.ipc.send("ImplAcceptedKeys", keys); });

    ime_api.onFocus.addListener((context, guid) =>      {
      // BUG: Try harder to show page action, if haven't.
      this.ShowPageAction();
      // Notify content.js new context results.
      this.ipc.send("Focus", context, guid);
    });

    ime_api.onImplCommitText.addListener(
      (contextID, text) => { this.ipc.send("ImplCommitText", contextID, text); });

    this.ipc.listen({
      IpcGetSystemStatus: () => {
        debug("IpcGetSystemStatus");
        return {
          enabled: croscin.instance.config.Emulation(),
          debug: croscin.instance.config.Debug() }; }
    }, (...args) => {
      debug("IPC uncaught event (will send to IME API):", args);
      return this.ime_api.dispatchEvent(...args);
    });
  }
}
