// Copyright 2025 Google Inc. All Rights Reserved.

/**
 * @fileoverview A general IPC interface via Storage
 * @author hungte@google.com (Hung-Te Lin)
 */
import { ChromeStorage } from "../jscin/storage.js";

export const NOTIFY_TARGET_CROSCIN = 'croscin';
export const NOTIFY_RELOAD_IM = 'ReloadIM';

// The Notify can't be implemented as chrome.runtime.sendMessage because we may
// run the IME inside the content script; e.g., the messages will be mixing
// tabs.sendMessage and chrome.runtime.sendMessage and being very complicated.

export class Notify {
  constructor(target) {
    this.storage = new ChromeStorage();
    target ||= NOTIFY_TARGET_CROSCIN;
    this.target = `_Notification#${target}`;
    this.callbacks = {};
  }

  Bind(event, callback) {
    let cbs = this.callbacks[event] || [];
    cbs.push(callback);
    this.callbacks[event] = cbs;
  }

  Send(name, value) {
    const timestamp = new Date().getTime();
    this.storage.set(this.target, {[name]: value, timestamp});
  }

  Listen() {
    this.storage.listen((changes) => {
      let event = changes[this.target]?.newValue;
      if (!event)
        return;
      for (let name in event) {
        for (let c of this.callbacks[name] || []) {
          c(event[name]);
        }
      }
    });
  }
}
