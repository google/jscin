// Copyright 2024 Google Inc. All Rights Reserved.

/**
 * @fileoverview IME UI panel for iframe based implementation.
 * @author hungte@google.com (Hung-Te Lin)
 */

import { AddLogger } from "../../jscin/logger.js";
const {log, debug, info, warn, error, assert, trace, logger} = AddLogger("iframe/ime_panel");

import { WebPageIme } from "../webpage.js";
import { ImeMessage } from "./ipc.js";

export class ImePanel extends WebPageIme {
  constructor(panel='imePanel') {
    super(panel);
    this.ipc = new ImeMessage(this);

    this.initialize();
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
