/**
 * @fileoverview Inter-process communication for Chrome Extensions.
 * http://www.sitepoint.com/chrome-extensions-bridging-the-gap-between-layers/
 */

export var ChromeExtensionIPC = {};

ChromeExtensionIPC.IPC = function (instance_type, namespace) {
  var self = this;

  self.ipcTypeName = '@chromeExtIpc@' + namespace;
  self.handlers = [];
  self._debug = false;
  self.debug = function() {
    if (self._debug)
      console.log.apply(console, ["[ipc]"].concat(
          Array.prototype.slice.apply(arguments)));
  }

  function CreateMessage(data) {
    return {
      ipc: self.ipcTypeName,
      data: data
    };
  }

  function AddHandler(handler) {
    self.handlers.push(handler);
  }

  function IsMessage(message) {
    return (typeof(message) == 'object' &&
            'ipc' in message && 'data' in message &&
            message.ipc == self.ipcTypeName);
  }

  function IpcHandler(message, response) {
    if (!IsMessage(message)) {
      self.debug("ipc> Invalid message:", message);
      return;
    }
    self.debug("ipc> IpcHandler:", message.data, self.handlers);
    self.handlers.forEach(function (handler) {
      var result = handler(message.data);
      if (typeof(result) != 'undefined' && response) {
        self.debug("ipc> response is returned:", handler, result);
        response(result);
        // chrome.runtime.onMessage cannot take more than one response .
        response = null;
      }
    });
  }

  if (instance_type == 'content') {
    return {
      attach: function () {
        // events from background
        chrome.runtime.onMessage.addListener(
            function(message, sender, response) {
              self.debug("ipc> recv<bg-cnt>:", instance_type, message, sender);
              IpcHandler(message, response);
            });
        // events from iframe
        window.addEventListener('message', function (e) {
          self.debug('ipc> recv<iframe-content>', instance_type, e);
          IpcHandler(e.data);
        });
      },
      send: function (message, callback) {
              // Send to background page
              if (callback) {
                self.debug("send with callback");
                chrome.runtime.sendMessage(CreateMessage(message), callback);
              } else {
                self.debug("send without callback");
                chrome.runtime.sendMessage(CreateMessage(message));
              }
      },
      recv: AddHandler
    };
  } else if (instance_type == 'iframe') {
    return {
      attach: function () {
        chrome.runtime.onMessage.addListener(
            function(message, sender, response) {
              self.debug("ipc> recv<iframe>:", instance_type, message, sender);
              IpcHandler(message, response);
            });
      },
      send: function (message) {
              // Send to parent (Content Side).
              window.parent.postMessage(CreateMessage(message), '*');
      },
      recv: AddHandler
    };
  } else if (instance_type == 'background') {
    return {
      attach: function () {
        chrome.runtime.onMessage.addListener(
            function(message, sender, response) {
              self.debug("ipc> recv<bg>:", instance_type, message, sender);
              IpcHandler(message, response);
            });
      },
      send: function (message, destination) {
              // to iframe and content.
              chrome.tabs.getSelected(null, function (tab) {
                if (!tab) return;
                chrome.tabs.sendMessage(tab.id, CreateMessage(message));
              });
      },
      recv: AddHandler
    };
  };
};
