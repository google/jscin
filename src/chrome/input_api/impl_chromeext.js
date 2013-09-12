// Copyright 2013 Google Inc. All Rights Reserved.

/**
 * @fileoverview Implementation bindings for attaching to Chrome Extension.
 * @author hungte@google.com (Hung-Te Lin)
 */

var ChromeInputImeImplChromeExtension = function (type) {
  var self = this;
  self.ime_api = chrome.input.ime;
  self.engineID = "chrome_input_ime#impl#chromeext";

  self._debug = false;
  self.log = function () {
    console.log.apply(console, arguments);
  }
  self.debug = function () {
    if (!self._debug)
      return;
    self.log.apply(null, arguments);
  }

  switch (type) {
    case 'background':
      self.init = self.InitBackground;
      break;
    case 'content':
      self.init = self.InitContent;
      break;
    default:
      self.log("ERROR: unknown type:", type);
      break;
  }

  return self;
};

ChromeInputImeImplChromeExtension.prototype.InitBackground = function () {
  var self = this;
  self.attach = function () { };

  var ime_api = self.ime_api;
  var ipc = new ImeEvent.ImeExtensionIPC('background');
  ipc.attach();

  function ShowPageAction() {
    chrome.tabs.getSelected(null, function(tab) {
      chrome.pageAction.show(tab.id);
    });
  }

  // Forward UI events to IME Frame.
  // Menu is installed by page action window.
  function ForwardUiToImeFrame (event_name) {
    return function (arg) {
      ipc.send(event_name, arg);
    };
  }
  ime_api.onUiComposition.addListener(ForwardUiToImeFrame("UiComposition"));
  ime_api.onUiCandidates.addListener(ForwardUiToImeFrame("UiCandidates"));
  ime_api.onUiCandidateWindow.addListener(
      ForwardUiToImeFrame("UiCandidateWindow"));

  // Send a refresh for content.js when any menu item is clicked.
  ime_api.onMenuItemActivated.addListener(function () {
    ipc.send("IpcRefreshIME");
  });

  ime_api.onActivate.addListener(function () {
    ShowPageAction();
  });
  ime_api.onFocus.addListener(function (context) {
    // BUG: Try harder to show page action, if haven't.
    ShowPageAction();
    // Notify content.js new context results.
    ipc.send("Focus", context);
  });
  ime_api.onImplCommitText.addListener(function (contextID, text) {
    ipc.send("ImplCommitText", contextID, text);
  });

  ipc.listen({
    IpcSnapshotIME: function () {
      self.debug("IpcSnapshotIME");
      return {
        im_data: jscin.getTableData(croscin.instance.im_name),
        im_name: croscin.instance.im_name,
        imctx: croscin.instance.imctx }; },

    IpcGetSystemStatus: function () {
      self.debug("IpcGetSystemStatus");
      return {
        default_enabled: croscin.instance.prefGetDefaultEnabled(),
        debug: croscin.instance.debug }; },

    IpcSetDefaultEnabled: function (new_value) {
      self.debug("IpcSetDefaultEnabled", new_value);
      return croscin.instance.prefSetDefaultEnabled(new_value); }

  }, function () {
    self.debug("Ipc Uncaught event:", arguments);
    return ime_api.dispatchEvent.apply(null, arguments);
  });
};

ChromeInputImeImplChromeExtension.prototype.InitContent = function () {
  var self = this;

  // Variables.
  self.frame = undefined;
  self.contextID = undefined;
  self.ipc = undefined;
  self.enabled = undefined;
  self.toggleHotKey = 16;  // Shift.
  self.waitForHotkey = false;

  function SendMessage() {
    self.ipc.send.apply(null, arguments);
  }

  function AttachKeyEvents(node) {
    node.addEventListener('keydown', KeyDownEventHandler);
    node.addEventListener('keyup', KeyUpEventHandler);
  }

  function DetachKeyEvents(node) {
    node.removeEventListener('keydown', KeyDownEventHandler);
    node.removeEventListener('keyup', KeyUpEventHandler);
  }

  function SetEnabled(enabled) {
    self.debug("SetEnabled", enabled, self.enabled);
    if (typeof(self.enabled) == 'undefined') {
      // First time setting enabled.
      self.enabled = enabled;
      // TODO(hungte) should we show frame?
    } else {
      // Apparently user is already doing something.
      self.enabled = enabled;
      if (enabled) {
        self.debug("setEnabled: frame.fadeIn(100)");
        self.frame.finish();
        self.frame.fadeIn(100);
      } else {
        self.debug("setEnabled: frame.fadeOut(100)");
        self.frame.finish();
        self.frame.fadeOut(100);
      }
      // Notify background page to change settings.
      SendMessage('IpcSetDefaultEnabled', enabled);
    }
  }

  function KeyUpEventHandler(ev) {
    // Assume our IME won't do anything on key up, let's only check hotkeys.
    if (!self.waitForHotkey)
      return;

    if (ev.keyCode == self.toggleHotKey) {
      self.debug("Got toggle hot key!", self.enabled);
      SetEnabled(!self.enabled);
    }
    self.waitForHotkey = false;
  }

  function UpdateUI() {
    self.debug("UpdateUI");
    var imctx = self.imctx;
    SendMessage("ImplUpdateUI", imctx.keystroke, imctx.mcch, imctx.selkey);
  }

  // Same as croscin.ProcessKeyEvent. Need self.im*.
  function ProcessKeyEvent(ev) {
    self.debug("ProcessKeyEvent:", ev.key);

    // Currently all of the modules uses key down.
    if (ev.type != 'keydown') {
      return false;
    }
    var ret = self.im.onKeystroke(self.imctx, ev);

    switch (ret) {
      case jscin.IMKEY_COMMIT:
        self.debug("im.onKeystroke: return IMKEY_COMMIT");
        UpdateUI();
        // croscin may have extra UI processing when committing text (ex,
        // cross-query) so we don't want to do ImplCommitText directly. Let's
        // route back to croscin.
        SendMessage("ImplCommit", self.imctx.cch);
        return true;

      case jscin.IMKEY_ABSORB:
        self.debug("im.onKeystroke: return IMKEY_ABSORB");
        UpdateUI();
        return true;

      case jscin.IMKEY_IGNORE:
        self.debug("im.onKeystroke: return IMKEY_IGNORE");
        UpdateUI();
        return false;
    }

    // default: Unknown return value.
    self.debug("ProcessKeyEvent: Unknown return value:", ret);
    return false;
  }

  function KeyDownEventHandler(ev) {
    if (!self.im) {
      self.debug("Key event before IM is ready.");
      return;
    }

    if (self.waitForHotkey)
      self.waitForHotkey = false;

    if (ev.keyCode == self.toggleHotKey && !ev.ctrlKey && !ev.altKey) {
      self.debug("Wait to check toggle hotkey!");
      self.waitForHotkey = true;
      // Assume our IME don't need to handle single shift key.
      return;
    }

    if (!self.enabled)
      return;

    var ev2 = ImeEvent.ImeKeyEvent(ev);
    var node = ev.target;
    self.debug("impl.KeyDownEventHandler", ev, ev2);

    // Simulation by SnapshotIME.
    if (ProcessKeyEvent(ev2)) {
      ev.preventDefault();
    }
  }

  function GetAbsoluteOffset(node) {
    var offset = { left: 0, 'top': 0};
    while (node) {
      offset.left += node.offsetLeft;
      offset['top'] += node.offsetTop;
      node = node.offsetParent;
    }
    return offset;
  }

  function ImplCommitText(node, text) {
    if (node.tagName == 'TEXTAREA' || node.tagName == 'INPUT') {
      // input or textarea.
      var newpos = node.selectionStart + text.length;
      node.value = (node.value.substring(0, node.selectionStart) +
                    text + node.value.substring(node.selectionEnd));
      node.selectionStart = newpos;
      node.selectionEnd = newpos;
      return;
    }

    // Probably a [contenteditable] element.
    var sel = window.getSelection();
    if (sel.rangeCount) {
      var range = sel.getRangeAt(0);
      range.deleteContents();
      var newnode = document.createTextNode(text);
      range.insertNode(newnode);
      range = range.cloneRange();
      range.setStartAfter(newnode);
      range.setEndAfter(newnode);
      sel.removeAllRanges();
      sel.addRange(range);
      range.commonAncestorContainer.normalize();
      return;
    }
  }

  function FocusHandler(ev) {
    var node = ev.target;
    self.debug("on focus", node);
    self.node = node;
    SendMessage("ImplFocus");
  }

  function BlurHandler(ev) {
    if (self.contextID) {
      self.debug("on blur", self.contextID);
      if (self.enabled) {
        self.debug("BlurHandler: frame.fadeOut(100)");
        self.frame.finish();
        self.frame.fadeOut(100);
      }
      DetachKeyEvents(ev.target);
      SendMessage("Blur", self.contextID);
      self.contextID = undefined;
    }
  }

  function SnapshotIME() {
    self.im = undefined;
    self.imctx = undefined;
    SendMessage("IpcSnapshotIME", function (result) {
      var name = result.im_name;
      self.debug("Snapshot - IM:", result);
      if (!name) {
        self.debug("Remote IM is not ready... good luck.");
        // TODO(hungte) Don't continue.
        return;
      }
      jscin.register_input_method(name, 'GenInp', 'snapshot');
      self.imctx = result.imctx || {};
      self.im = jscin.create_input_method(name, self.imctx, result.im_data);
    });
  }

  function InitContent() {
    var ipc = new ImeEvent.ImeExtensionIPC('content');
    self.ipc = ipc;
    ipc.attach();

    ipc.listen({
      IpcUiReady: function () {
        self.debug("UIReady",document.activeElement);
        SendMessage("Activate", self.engineID); // Update menu & pageAction.
        // Delayed init.
        if (self.init_node) {
          self.debug("Found init_node:", self.init_node);
          FocusHandler({target: self.init_node});
        }
        self.init_node = undefined;
      },

      IpcRefreshIME: function () {
        // Need to request for another snapshot.
        SnapshotIME();
      },

      ImplCommitText: function (contextID, text) {
        ImplCommitText(self.node, text);
      },

      Focus: function (context) {
        var node = self.node;
        self.contextID = context.contextID;
        AttachKeyEvents(node);

        var offset = GetAbsoluteOffset(node);
        offset.left += 5;
        // TODO(hungte) Remove jquery -- although height() is hard to replace.
        offset.top += $(node).height();
        self.frame.css(offset);
        if (self.enabled) {
          self.debug("Focus: frame.fadeIn(250)", self.frame.offset());
          self.frame.finish();
          self.frame.fadeIn(250);
        }
      },

      MenuItemActivated: function (engineID, name) {
        // (Legacy, when menu is included in iframe) forward to background.
        self.ipc.send.apply("MenuItemActivated", engineID, name);
        SnapshotIME();
      }
    });

    SendMessage('IpcGetSystemStatus', function (result) {
      self.debug("IpcGetSystemStatus received:", result);
      self._debug = result.debug;
      SetEnabled(result.default_enabled);
    });
    SnapshotIME();
  }

  self.attach = function (node) {
    node.addEventListener("focus", FocusHandler);
    node.addEventListener("blur", BlurHandler);
  };

  self.setFrame = function (frame) {
    self.frame = frame;
  }

  self.setInitNode = function (node) {
    self.init_node = node;
  }

  InitContent();
};
