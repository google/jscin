// Copyright 2024 Google Inc. All Rights Reserved.

/**
 * @fileoverview IME UI panel for extension based implementation.
 * @author hungte@google.com (Hung-Te Lin)
 */

import { AddLogger } from "../../jscin/logger.js";
const {log, debug, info, warn, error, assert, trace, logger} = AddLogger("crext/ime_panel");

import { WebPageIme } from "../webpage.js";
import { ImeMessage } from "./ipc.js";

export class ImePanel extends WebPageIme {
  constructor(panel='imePanel') {
    super(panel);
    this.seed = this.getSeed();
    this.ipc = new ImeMessage(this, this.seed);
    this.initialize();
  }

  getSeed() {
    let url = document.location.href;
    return url.match(/\?seed=(.+)/)[1] || undefined;
  }

  async initialize() {
    await this.ipc.initialize(true);

    // Forward these events to the content script.
    this.ipc.forwardEventToContent('Activate');
    this.ipc.forwardEventToContent('CandidateClicked');

    // Notify the IME it's ready to update the panel (or, re-do in onFocus).
    this.onActivate.dispatch(this.engineID);

    this.enableActionPopup();
  }

  enableActionPopup() {
    if (chrome.pageAction)
      chrome.pageAction.show(this.ipc.getTabId());
    else if (chrome.action)
      chrome.action.enable(this.ipc.getTabId());
  }
}

// register in the global name space.
globalThis.panel = new ImePanel();
globalThis.logger = logger;
