// Copyright 2024 Google Inc. All Rights Reserved.

/**
 * @fileoverview IPC between extension components
 * @author hungte@google.com (Hung-Te Lin)
 *
 * content script -> extension: chrome.runtime.sendMessage(msg)
 * extension -> content script: chrome.tabs.sendMessage(tab_id, msg)
 * The 'extension' is defined by URL, including: ime_frame, background, menu.
 * The 'content' is the content script running in a tab.
 * Note: ime_frame and the content script are in the same tab so it knows which
 * tab_id to send)
 */

const IME_EVENT_MESSAGE_TYPE = 'jscin.ime_event';

class ImeBaseMessage {
  constructor(type, tab_id) {
    this.type = type;
    this.tab_id = tab_id;
  }
  dispatch(ime) {
    console.error("ImeBaseMessage.dispatch: NOT_IMPL", ime);
    throw "Unimplemented message for dispatching.";
  }

  async sendToExtension() {
    return chrome.runtime.sendMessage(this);
  }
  async sendToTab(tab_id) {
    tab_id ||= this.tab_id;
    if (!tab_id) {
      console.log("sendToTab: no tab_id, probably in menu init?");
      return;
    }
    return chrome.tabs.sendMessage(tab_id, this);
  }

  // Context-aware shortcuts.
  async sendToMenu() {
    return this.sendToExtension();
  }
  async sendToPanel() {
    return this.sendToExtension();
  }
  async sendToContent(tab_id) {
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
    let tab = await chrome.tabs.getCurrent();
    return tab?.id;
  }
  async getActiveTab() {
    if (!chrome.tabs.query)
      return;
    let [tab] = await chrome.tabs.query({active: true, lastFocusedWindow: true});
    return tab?.id;
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

  async sendCommandToPanel(command, parameters) {
    return this.ipc.Command(command, parameters).sendToPanel();
  }
  async sendCommandToMenu(command, parameters) {
    return this.ipc.Command(command, parameters).sendToMenu();
  }
  async forwardEventToContent(...args) {
    return this.ipc.forwardEventToContent(...args);
  }
  async forwardEventToPanel(...args) {
    return this.ipc.forwardEventToPanel(...args);
  }
  getTabId() {
    return this.ipc.getTabId();
  }

  // Extra APIs
  onMenuPopup = this._createEventHandler("MenuPopup");
  onOpenOptionsPage = this._createEventHandler("OpenOptionsPage");
}
