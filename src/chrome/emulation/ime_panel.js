// Copyright 2024 Google Inc. All Rights Reserved.

/**
 * @fileoverview IME UI panel for iframe based implementation.
 * @author hungte@google.com (Hung-Te Lin)
 */

import { AddLogger } from "../jscin/logger.js";
const {log, debug, info, warn, error, assert, trace, logger} = AddLogger("emulation/ime_panel");

import { WebPageIme } from "./webpage.js";

export class ImePanel extends WebPageIme {
  constructor(panel='imePanel') {
    super(panel);
    window.addEventListener("message", this.messageHandler.bind(this));

    this.onMenuItemActivated.addListener((...args) => {
      window.top.postMessage({ime_ev: "MenuItemActivated", args}, "*");
    });
    this.onCandidateClicked.addListener((...args) => {
      window.top.postMessage({ime_ev: "CandidateClicked", args}, "*");
    });
  }

  messageHandler(e) {
    let data = e.data;
    if (!data.ime)
      return;

    debug("messageHandler:", data.ime, data.parameters);
    // data.ime is the command to invoke, and data.parameters is the arg.
    this[data.ime](data.parameters);
  }
}

// register in the global name space.
globalThis.panel = new ImePanel();
globalThis.logger = logger;
