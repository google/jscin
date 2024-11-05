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

    // Notify the IME it's ready to update the panel (or, re-do in onFocus).
    this.onActivate.dispatch(this.engineID);
    chrome.pageAction.show(this.tab_id);
  }

  messageHandler(m, sender) {
    // Filter out messages from content scripts in different tabs.
    if (sender.tab && sender.tab.id != this.tab_id)
      return;

    let msg;

    msg = ImeCommandMessage.fromObject(m);
    if (!msg)
      msg = ImeEventMessage.fromObject(m);
    if (!msg) {
      debug("messageHandler: not a valid IME command/event message:", m);
      return;
    }
    msg.dispatch(this);
  }
}

// register in the global name space.
globalThis.panel = new ImePanel();
globalThis.logger = logger;
