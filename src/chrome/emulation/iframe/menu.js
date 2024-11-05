// Copyright 2013 Google Inc. All Rights Reserved.
/**
 * @fileoverview Implementation of IME menu for page-action.
 * @author hungte@google.com (Hung-Te Lin)
 */

import { AddLogger } from "../../jscin/logger.js";
const {log, debug, info, warn, error, assert, trace, logger} = AddLogger("iframe/menu");

import { WebPageIme } from "../webpage.js";
import { ImeEventMessage, ImeCommandMessage } from "./ipc.js";

export class ImeMenu extends WebPageIme {
  constructor(panel='imePanel') {
    super(panel);
    this.tab_id = undefined;

    // Get current tab ID.
    chrome.tabs.getSelected((tab) => {
      debug("current tab:", tab);
      this.tab_id = tab.id;
      this.initialize();
    });
  }

  initialize() {
    chrome.runtime.onMessage.addListener(this.messageHandler.bind(this));

    function sendToExtension(event) {
      return (...args) => {
        let msg = new ImeEventMessage(event, ...args);
        debug("Send ImeEventMessage to the extension components:", msg);
        chrome.runtime.sendMessage(msg);
      };
    }

    let sendToContent = (event) => {
      return (...args) => {
        let msg = new ImeEventMessage(event, ...args);
        debug("Send ImeEventMessage to the content script:", msg);
        chrome.tabs.sendMessage(this.tab_id, msg);
      };
    }

    // TODO(hungte) It is possible to do chrome.runtime.openOptionsPage() in
    // the menu... But for now let's let the content do it (implies broadcast
    // to the background page).
    this.onMenuItemActivated.addListener(sendToContent("MenuItemActivated"));
    this.onActivate.addListener(sendToExtension("Activate"));
    this.onActivate.dispatch(this.engineID);
  }

  messageHandler(obj, sender) {
    debug("messageHandler:", obj);
    let msg = ImeCommandMessage.fromObject(obj);
    if (!msg)
      return;

    debug("dispatch:", msg);
    msg.dispatch(this);
  }
}

// register in the global name space.
globalThis.menu = new ImeMenu();
globalThis.logger = logger;
