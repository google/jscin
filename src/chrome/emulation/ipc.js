/**
 * @fileoverview Inter-process communication for Chrome Extensions.
 * http://www.sitepoint.com/chrome-extensions-bridging-the-gap-between-layers/
 */

import { AddLogger } from "../jscin/logger.js";
const {log, debug, info, warn, error, assert, trace} = AddLogger("ipc");

class BaseIPC {

  constructor(namespace) {
    this.ipcTypeName = '@chromeExtIpc@' + namespace;
    this.handlers = [];
  }

  CreateMessage(data) {
    return {
      ipc: this.ipcTypeName,
      data: data
    };
  }

  AddHandler(handler) {
    this.handlers.push(handler);
  }

  IsMessage(message) {
    return (typeof(message) == 'object' &&
            'ipc' in message && 'data' in message &&
            message.ipc == this.ipcTypeName);
  }

  IpcHandler(message, response) {
    if (!this.IsMessage(message)) {
      debug("ipc> Invalid message:", message);
      return;
    }
    debug("ipc> IpcHandler:", message.data, this.handlers);
    this.handlers.forEach((handler) => {
      let result = handler(message.data);
      if (typeof(result) != 'undefined' && response) {
        debug("ipc> response is returned:", handler, result);
        response(result);
        // chrome.runtime.onMessage cannot take more than one response .
        response = null;
      }
    });
  }

  /*
   * DOM KeyboardEvent can't be passed via IPC so we have to marshalize
   * it to a simple object, and let's call it IpcKeyEvent.
   */
  CreateIpcKeyEvent(ev) {
    let ev2 = {};
    // https://www.w3.org/TR/uievents/#idl-keyboardevent
    const known_props = [
      "type",

      "key",
      "code",
      "location",

      "ctrlKey",
      "shiftKey",
      "altKey",
      "metaKey",

      "repeat",
      "isComposing",

      // deprecated fields.
      "charCode",
      "keyCode",
      "which",
    ];

    // Only copy  known properties because Object.assign will fail on readonly
    // properties like isTrusted.
    for (let k of known_props) {
      ev2[k] = ev[k];
    }
    debug("CreateIpcKeyEvent", ev, ev2);
    return ev2;
  }

  /* Create real KeyboardEvent from an IpcKeyEvent. */
  CreateKeyboardEvent(ev)
  {
    if (KeyboardEvent)
      return new KeyboardEvent(ev.type, ev);

    debug("Missing KeyboardEvent, keep using ImeKeyEvent", ev);
    return ev;
  }

  /* IPC interfaces */

  attach() {
    assert(false, "NOT_IMPL: IPC:attach placeholder.");
  }

  send(message) {
    assert(false, "NOT_IMPL: IPC:send placeholder.");
  }

  recv(handler) {
    return this.AddHandler(handler);
  }
}

class ContentIPC extends BaseIPC {
  attach() {
    // events from background
    chrome.runtime.onMessage.addListener(
      (message, sender, response) => {
        debug("ipc> recv<bg-cnt>:", "content", message, sender);
        this.IpcHandler(message, response);
      });
    // events from iframe
    window.addEventListener('message', (e) => {
      debug('ipc> recv<iframe-content>', "content", e);
      this.IpcHandler(e.data);
    });
  }
  send(message, callback) {
    // Send to background page
    if (message.args && message.args[0] == 'KeyEvent') {
      message.args[2] = this.CreateIpcKeyEvent(message.args[2]);
    }
    if (callback) {
      debug("send with callback");
      chrome.runtime.sendMessage(this.CreateMessage(message), callback);
    } else {
      debug("send without callback");
      chrome.runtime.sendMessage(this.CreateMessage(message));
    }
  }
}

class BackgroundIPC extends BaseIPC {
  attach() {
    chrome.runtime.onMessage.addListener(
      (message, sender, response) => {
        debug("ipc> recv<bg>:", 'background', message, sender);
        this.IpcHandler(message, response);
      });
  }
  send(message, destination) {
    // to iframe and content.
    chrome.tabs.getSelected(null, (tab) => {
      if (!tab) return;
      chrome.tabs.sendMessage(tab.id, this.CreateMessage(message));
    });
  }
}

class IFrameIPC extends BaseIPC {
  attach() {
    chrome.runtime.onMessage.addListener(
      (message, sender, response) => {
        debug("ipc> recv<iframe>:", 'iframe', message, sender);
        this.IpcHandler(message, response);
      });
  }
  send(message) {
    // Send to parent (Content Side).
    window.parent.postMessage(this.CreateMessage(message), '*');
  }
}

function CreateIPC(type, domain) {
  if (type == 'iframe')
    return new IFrameIPC(domain);
  if (type == 'background')
    return new BackgroundIPC(domain);
  if (type == 'content')
    return new ContentIPC(domain);
  error("Invalid type:", type);
}

export class ImeExtensionIPC {

  constructor(type) {
    this.kIpcDomain = 'croscin';
    this.ipc = CreateIPC(type, this.kIpcDomain);
  }

  attach() {
    return this.ipc.attach();
  }

  send(...args) {
    let callback = undefined;
    if (args.length > 0 && typeof(args.at(-1)) === 'function') {
      callback = args.at(-1);
      args = args.slice(0, args.length - 1);
    }

    return this.ipc.send({ime: this.kIpcDomain, args: args}, callback);
  }

  listen(map, other) {
    this.ipc.recv((evt) => {
      if (evt.ime != this.kIpcDomain)
        return;
      if (evt.args.length) {
        let callback = map[evt.args[0]];
        if (callback)
          return callback(...evt.args.slice(1));
      }
      if (other)
        return other(...evt.args);
    });
  }

  recv(callback) {
    this.ipc.recv((evt) => {
      if (evt.ime != this.kIpcDomain)
        return;
      return callback(...evt.args);
    });
  }
}
