// Copyright 2013 Google Inc. All Rights Reserved.
/**
 * @fileoverview Implementation of IME menu for page-action.
 * @author hungte@google.com (Hung-Te Lin)
 */

import { AddLogger } from "../../jscin/logger.js";
const {logger} = AddLogger("ipc/menu");

import { IpcIme } from "./ipc.js";

export class ImeMenu extends IpcIme {
  constructor(panel='imePanel') {
    super(panel);

    this.initialize();
  }

  async initialize() {
    await super.initialize();

    // It is possible to do chrome.runtime.openOptionsPage() in the menu, but
    // then we have to either duplicate the whole menu ID parsing logic, or
    // create a dedicated new event for that. So we let the content script
    // (where croscin lives) do that.
    this.forwardEventToContent('MenuItemActivated');

    // MenuPopup is a special event only implemented by ipc based (emulation)
    // IME API, and will be provided by croscin inside ipc_content.js.
    this.forwardEventToContent("MenuPopup");
    this.onMenuPopup.dispatch();
  }
}

// register in the global name space.
globalThis.menu = new ImeMenu();
globalThis.logger = logger;
