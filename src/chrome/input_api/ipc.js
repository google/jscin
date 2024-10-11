/**
 * @fileoverview Inter-process communication for Chrome Extensions.
 * http://www.sitepoint.com/chrome-extensions-bridging-the-gap-between-layers/
 */

class BaseIPC {

  constructor(namespace) {
    this.ipcTypeName = '@chromeExtIpc@' + namespace;
    this.handlers = [];
    this._debug = false;
  }

  debug(...args) {
    if (!this._debug)
      return;
    console.log("[ipc]", ...args);
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
      this.debug("ipc> Invalid message:", message);
      return;
    }
    this.debug("ipc> IpcHandler:", message.data, this.handlers);
    this.handlers.forEach((handler) => {
      let result = handler(message.data);
      if (typeof(result) != 'undefined' && response) {
        this.debug("ipc> response is returned:", handler, result);
        response(result);
        // chrome.runtime.onMessage cannot take more than one response .
        response = null;
      }
    });
  }

  /* IPC interfaces */

  attach() {
    console.log("IPC:attach placeholder.");
  }

  send(message) {
    console.log("IPC:send placeholder.");
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
        this.debug("ipc> recv<bg-cnt>:", "content", message, sender);
        this.IpcHandler(message, response);
      });
    // events from iframe
    window.addEventListener('message', (e) => {
      this.debug('ipc> recv<iframe-content>', "content", e);
      this.IpcHandler(e.data);
    });
  }
  send(message, callback) {
    // console.log(this);
    // Send to background page
    if (callback) {
      this.debug("send with callback");
      chrome.runtime.sendMessage(this.CreateMessage(message), callback);
    } else {
      this.debug("send without callback");
      chrome.runtime.sendMessage(this.CreateMessage(message));
    }
  }
}

class BackgroundIPC extends BaseIPC {
  attach() {
    chrome.runtime.onMessage.addListener(
      (message, sender, response) => {
        this.debug("ipc> recv<bg>:", 'background', message, sender);
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
        this.debug("ipc> recv<iframe>:", 'iframe', message, sender);
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
  console.log("Invalid type:", type);
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
