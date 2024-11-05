// Copyright 2024 Google Inc. All Rights Reserved.

/**
 * @fileoverview IME UI panel for iframe based implementation.
 * @author hungte@google.com (Hung-Te Lin)
 */

import { AddLogger } from "../../jscin/logger.js";
const {log, debug, info, warn, error, assert, trace, logger} = AddLogger("iframe/ime_panel");

import { WebPageIme } from "../webpage.js";
import { ImeEventMessage, ImeCommandMessage } from "./ipc.js";

export class ImePanel extends WebPageIme {
  constructor(panel='imePanel') {
    super(panel);
    this.tab_id = undefined;

    // Get current tab ID.
    chrome.tabs.getCurrent((tab) => {
      debug("current tab:", tab);
      this.tab_id = tab.id;
      this.initialize();
    });
  }

  initialize() {
    let sendEventToContent = (event) => {
      return (...args) => {
        let msg = new ImeEventMessage(event, ...args);
        chrome.tabs.sendMessage(this.tab_id, msg);
      };
    }

    // Listen to events
    chrome.runtime.onMessage.addListener(this.messageHandler.bind(this));

    // Forward these events to the content script.
    this.onActivate.addListener(sendEventToContent("Activate"));
    this.onCandidateClicked.addListener(sendEventToContent("CandidateClicked"));
    this.onMenuItemActivated.addListener(sendEventToContent("MenuItemActivated"));

    // Notify the IME it's ready to update the panel (or, re-do in onFocus).
    this.onActivate.dispatch(this.engineID);
  }

  messageHandler(m, sender) {
    if (sender.tab.id != this.tab_id)
      return;

    let cmd = ImeCommandMessage.fromObject(m);
    if (!cmd) {
      debug("messageHandler: not a valid IME command message:", m);
      return;
    }
    cmd.dispatch(this);
  }
}

// register in the global name space.
globalThis.panel = new ImePanel();
globalThis.logger = logger;
