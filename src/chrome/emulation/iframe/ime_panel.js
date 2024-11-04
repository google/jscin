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

    window.addEventListener("message", this.messageHandler.bind(this));

    function sendToContent(event) {
      return (...args) => {
        let msg = new ImeEventMessage(event, ...args);
        debug("Send ImeEventMessage to the content script:", msg);
        window.parent.postMessage(msg, '*');
      };
    }

    // Forward these events to the content script.
    this.onMenuItemActivated.addListener(sendToContent("MenuItemActivated"));
    this.onCandidateClicked.addListener(sendToContent("CandidateClicked"));
    this.onActivate.addListener(sendToContent("Activate"));

    // Notify the IME to update the panel.
    this.onActivate.dispatch(this.engineID);
  }

  messageHandler(m) {
    let cmd = ImeCommandMessage.fromObject(m.data);
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
