// Copyright 2024 Google Inc. All Rights Reserved.

/**
 * @fileoverview IPC between extension components
 * @author hungte@google.com (Hung-Te Lin)
 *
 * content script -> extension: chrome.runtime.sendMessage(msg)
 * extension -> content script: chrome.tabs.sendMessage(tab_id, msg)
 * The 'extension' is defined by URL, including: ime_panel, background, menu.
 * The 'content' is the content script running in a tab.
 * Note: ime_panel and the content script are in the same tab so it knows which
 * tab_id to send)
 */

const IME_EVENT_MESSAGE_TYPE = 'jscin.ime_event';

class ImeBaseMessage {
  constructor(type, tab_id) {
    this.type = type;
    this.tab_id = tab_id;
  }
  dispatch(ime) {
    throw "Unimplemented message for dispatching.";
  }

  sendToExtension() {
    chrome.runtime.sendMessage(this);
  }
  sendToTab(tab_id) {
    tab_id ||= this.tab_id;
    chrome.tabs.sendMessage(tab_id, this);
  }

  // Context-aware shortcuts.
  sendToMenu() {
    return this.sendToExtension();
  }
  sendToPanel() {
    return this.sendToExtension();
  }
  sendToContent(tab_id) {
    return this.sendToTab(tab_id);
  }
}

class ImeEventMessage extends ImeBaseMessage {
  constructor(tab_id, event, ...args) {
    super(IME_EVENT_MESSAGE_TYPE, tab_id);
    this.event = event;
    this.args = args;
  }
  getEvent() {
    return this.event;
  }
  getArgs() {
    return this.args;
  }
  dispatch(ime) {
    let target = `on${this.getEvent()}`;
    return ime[target].dispatch(...this.getArgs());
  }
}

const IME_COMMAND_MESSAGE_TYPE = 'jscin.ime_command';

class ImeCommandMessage extends ImeBaseMessage {
  constructor(tab_id, command, parameters) {
    super(IME_COMMAND_MESSAGE_TYPE, tab_id);
    this.command = command;
    this.parameters = parameters;
  }
  getCommand() {
    return this.command;
  }
  getParameters() {
    return this.parameters;
  }
  dispatch(ime) {
    return ime[this.getCommand()](this.getParameters());
  }
}

export class ImeMessage {
  constructor(ime, seed) {
    this.tab_id = undefined;
    this.seed = seed;
    this.ime = ime;
  }
  async initialize(check_sender) {
    this.tab_id = await this.findTabId();

    chrome.runtime.onMessage.addListener((msg, sender) => {
      // Filter out messages from content scripts in different tabs.
      if (check_sender && sender.tab &&
          sender.tab.id != this.tab_id)
        return;
      if (this.seed && msg.seed && this.seed != msg.seed) {
        return;
      }

      let m = this.fromObject(msg);
      if (!m)
        return;
      m.dispatch(this.ime);
    });
  }
  async getCurrentTab() {
    if (!chrome.tabs.getCurrent)
      return;
    return new Promise((resolve) => {
      chrome.tabs.getCurrent((tab) => {
        resolve(tab?.id);
      })
    });
  }
  async getActiveTab() {
    if (!chrome.tabs.query)
      return;
    return new Promise((resolve) => {
      chrome.tabs.query({active: true, lastFocusedWindow: true},
        ([tab]) => {
          resolve(tab?.id);
        });
    });
  }
  async findTabId() {
    if (!chrome.tabs)
      return;
    let id = await this.getCurrentTab();
    if (!id)
      id = await this.getActiveTab();
    return id;
  }
  getTabId() {
    return this.tab_id;
  }

  fromObject(obj) {
    if (obj.type == IME_EVENT_MESSAGE_TYPE)
      return new ImeEventMessage(this.tab_id, obj.event, ...obj.args);
    if (obj.type == IME_COMMAND_MESSAGE_TYPE)
      return new ImeCommandMessage(this.tab_id, obj.command, obj.parameters);
    return null;
  }

  Command(...args) {
    let obj = new ImeCommandMessage(this.tab_id, ...args);
    if (this.seed)
      obj.seed = this.seed;
    return obj;
  }
  Event(...args) {
    let obj = new ImeEventMessage(this.tab_id, ...args);
    if (this.seed)
      obj.seed = this.seed;
    return obj;
  }

  forwardEventToContent(event) {
    this.ime[`on${event}`].addListener((...args) => {
      let msg = this.Event(event, ...args);
      msg.sendToContent();
    });
  }
  forwardEventToPanel(event) {
    this.ime[`on${event}`].addListener((...args) => {
      let msg = this.Event(event, ...args);
      msg.sendToPanel();
    });
  }
}

import { WebPageIme } from "../webpage.js";

export class IpcIme extends WebPageIme {
  constructor(panel, seed) {
    super(panel);
    this.seed = seed;
    this.panel = panel;
    this.ipc = new ImeMessage(this, seed);

    // Derived classes should call initialize to make sure it will happen in
    // the last step.
  }

  async initialize(...args) {
    return this.ipc.initialize(...args);
  }

  sendCommandToPanel(command, parameters) {
    this.ipc.Command(command, parameters).sendToPanel();
  }
  forwardEventToContent(...args) {
    return this.ipc.forwardEventToContent(...args);
  }
  forwardEventToPanel(...args) {
    return this.ipc.forwardEventToPanel(...args);
  }
  getTabId() {
    return this.ipc.getTabId();
  }

  // Extra APIs
  onMenuPopup = this.createEventHandler("MenuPopup");
}
