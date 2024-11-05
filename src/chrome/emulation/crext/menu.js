// Copyright 2013 Google Inc. All Rights Reserved.
/**
 * @fileoverview Implementation of IME menu for page-action.
 * @author hungte@google.com (Hung-Te Lin)
 */

import { AddLogger } from "../../jscin/logger.js";
const {log, debug, info, warn, error, assert, trace, logger} = AddLogger("crext/menu");

import { WebPageIme } from "../webpage.js";
import { ImeMessage } from "./ipc.js";

export class ImeMenu extends WebPageIme {
  constructor(panel='imePanel') {
    super(panel);
    this.ipc = new ImeMessage(this);
    this.initialize();
  }

  async initialize() {
    await this.ipc.initialize();

    let sendToPanel = (event) => {
      return (...args) => {
        let msg = this.ipc.Event(event, ...args);
        msg.sendToPanel();
      };
    }

    // TODO(hungte) It is possible to do chrome.runtime.openOptionsPage() in
    // the menu... But for now let's let the content do it (implies broadcast
    // to the background page).
    this.ipc.forwardEventToContent('MenuItemActivated');

    // Technically, sending Activate is not correct because this will also
    // trigger selecting the default input method. We may change croscin
    // behavior to not switch IM when target is not specified and IM already
    // started. Also, here we send to panel instead of content because the menu
    // does not have a way to figure out current tab id (for the content).
    this.ipc.forwardEventToPanel("Activate");
    this.onActivate.dispatch(this.engineID);
  }
}

// register in the global name space.
globalThis.menu = new ImeMenu();
globalThis.logger = logger;
