// Copyright 2024 Google Inc. All Rights Reserved.

/**
 * @fileoverview IME UI panel for extension based implementation.
 * @author hungte@google.com (Hung-Te Lin)
 */

import { AddLogger } from "../../jscin/logger.js";
const {logger} = AddLogger("ipc/ime_frame");

import { IpcIme } from "./ipc.js";

export class ImeFrame extends IpcIme {
  constructor(panel='imePanel') {
    // The seed was provided by ipc_content.js#IpcContentIme
    const seed = document.location.href.match(/\?seed=(.+)/)[1] || undefined;
    super(panel, seed);

    this.initialize();
  }

  async initialize() {
    await super.initialize()

    // Forward these events to the content script.
    this.forwardEventToContent('Activate');
    this.forwardEventToContent('CandidateClicked');

    this.onOpenOptionsPage.addListener(() => {
      chrome.runtime.openOptionsPage();
    });

    // Notify the IME it's ready to update the panel (or, re-do in onFocus).
    this.onActivate.dispatch(this.engineID);

    this.enableActionPopup();
  }

  enableActionPopup() {
    if (chrome.pageAction)
      chrome.pageAction.show(this.getTabId());
    else if (chrome.action)
      chrome.action.enable(this.getTabId());
  }
}

// register in the global name space.
globalThis.croscin = globalThis.frame = new ImeFrame();
globalThis.logger = logger;
