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
  ime_api.onFocus.addListener(function (context, guid) {
    // BUG: Try harder to show page action, if haven't.
    ShowPageAction();
    // Notify content.js new context results.
    ipc.send("Focus", context, guid);
  });
  ime_api.onImplCommitText.addListener(function (contextID, text) {
    ipc.send("ImplCommitText", contextID, text);
  });

  ipc.listen({
    IpcSnapshotIME: function () {
      self.debug("IpcSnapshotIME");
      return {
        im_module: jscin.getDefaultModuleName(),
        im_data: jscin.getTableData(croscin.instance.im_name),
        im_name: croscin.instance.im_name,
        imctx: croscin.instance.imctx }; },

    IpcGetSystemStatus: function () {
      self.debug("IpcGetSystemStatus");
      return {
        default_enabled: croscin.instance.prefGetDefaultEnabled(),
        debug: croscin.instance.debug }; }

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
  self.attached = [];

  function IsChildFrame() {
    return window.self !== window.top;
  }

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
    self.debug("SetEnabled", enabled);
    if (typeof(self.enabled) == 'undefined') {
      // First time setting enabled.
      self.enabled = enabled;
    } else {
      // Apparently user is already doing something.
      self.enabled = enabled;
      if (enabled) {
        self.debug("setEnabled: showFrame");
        self.showFrame();
      } else {
        self.debug("setEnabled: hideFrame");
        self.hideFrame();
      }
    }
    if (enabled && !self.im) {
      SnapshotIME();
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

    if (!self.im) {
      self.debug("ERROR: Key event before IM is ready.");
      return;
    }

    var ev2 = ImeEvent.ImeKeyEvent(ev);
    var node = ev.target;
    self.debug("impl.KeyDownEventHandler", ev, ev2);

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
    var ev = document.createEvent("TextEvent");
    ev.initTextEvent("textInput", true, true, window, text);
    node.dispatchEvent(ev);
  }

  function FocusHandler(ev) {
    var node = ev.target;
    self.debug("on focus", node);
    self.node = node;
    self.guid = jscin.guid();
    SendMessage("ImplFocus", self.guid);
  }

  function BlurHandler(ev) {
    if (self.contextID) {
      self.debug("on blur", self.contextID);
      if (self.enabled) {
        self.debug("BlurHandler: hideFrame");
        self.hideFrame();
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
      self.debug("Snapshot - IM:", result, window.self.location);
      if (!name) {
        self.debug("Remote IM is not ready... good luck.");
        // TODO(hungte) Don't continue.
        return;
      }
      jscin.register_input_method(name, result.im_module, 'snapshot');
      self.imctx = result.imctx || {};
      self.im = jscin.create_input_method(name, self.imctx, result.im_data);
    });
  }

  function FindElementByFrame(frame) {
    var nodes = document.getElementsByTagName('iframe');
    for (var i = 0, len = nodes.length; i < len; i++) {
      if (nodes[i].contentWindow == frame)
        return nodes[i];
    }
    return undefined;
  }

  function SendFrameMessage(view, command, arg) {
    view.postMessage({ ime: 'frame', command: command, arg: arg}, '*');
  }

  function GetFrameMessage(ev) {
    if (!ev.data || ev.data.ime != 'frame')
      return undefined;
    return ev.data;
  }

  function AddFrameOffset(offset, frame) {
    frame = FindElementByFrame(frame);
    if (!frame)
      return offset;
    var frame_offset = GetAbsoluteOffset(frame);
    offset.left += frame_offset.left;
    offset.top += frame_offset.top;
    return offset;
  }

  function InitContent() {
    var ipc = new ImeEvent.ImeExtensionIPC('content');
    self.ipc = ipc;
    ipc.attach();

    ipc.listen({
      IpcUiReady: function () {
        self.debug("UIReady");
        SendMessage("Activate", self.engineID); // Update menu & pageAction.
      },

      IpcRefreshIME: function () {
        // Need to request for another snapshot.
        SnapshotIME();
      },

      ImplCommitText: function (contextID, text) {
        if (contextID != self.contextID)
          return;
        ImplCommitText(self.node, text);
      },

      Focus: function (context, guid) {
        if (guid != self.guid)
          return;
        var node = self.node;
        self.contextID = context.contextID;
        AttachKeyEvents(node);

        self.attachFrame(node);
        if (self.enabled) {
          self.debug("Focus: showFrame");
          self.showFrame(true);
        }
      },

      MenuItemActivated: function (engineID, name) {
        // (Legacy, when menu is included in iframe) forward to background.
        self.ipc.send.apply("MenuItemActivated", engineID, name);
        SnapshotIME();
      }
    });

    window.addEventListener("message", function (e) {
      var msg = GetFrameMessage(e);
      if (!msg)
        return;

      switch (msg.command) {
        case 'hide':
          self.hideFrame();
          break;
        case 'show':
          self.showFrame();
          break;
        case 'move':
          self.moveFrame(AddFrameOffset(msg.arg, e.source));
          break;
      }
    });

    SendMessage('IpcGetSystemStatus', function (result) {
      self.debug("IpcGetSystemStatus received:", result, window.self.location);
      self._debug = result.debug;
      SetEnabled(result.default_enabled);
      ListenOnFocus();
    });
  }

  function IsEditableNode(node) {
    return node && (node.nodeName == 'INPUT' || node.nodeName == 'TEXTAREA' ||
                    node.getAttribute('contenteditable'));
  }

  function IsAttached(node) {
    return self.attached.indexOf(node) >= 0;
  }

  function ListenOnFocus() {
    document.addEventListener("focusin", function (ev) {
      var node = ev.target;
      if (!IsEditableNode(node) || IsAttached(node))
        return;
      self.attach(node, true);
    });
    var node = document.activeElement;
    if (IsEditableNode(node)) {
      self.attach(node, true);
    }
  }

  self.attach = function (node, fire) {
    if (self.attached.indexOf(node) < 0) {
      self.debug("impl.attach:", node, fire);
      self.attached.push(node);
      node.addEventListener("focus", FocusHandler);
      node.addEventListener("blur", BlurHandler);
    }
    if (fire)
      FocusHandler({target: node});
  };

  self.setFrame = function (frame) {
    self.frame = frame;
  }

  self.showFrame = function (long_animation) {
    if (IsChildFrame())
      return SendFrameMessage(window.top, "show");
    self.frame.finish();
    self.frame.fadeIn(long_animation ? 250 : 100);
  }

  self.hideFrame = function () {
    if (IsChildFrame())
      return SendFrameMessage(window.top, 'hide');
    self.frame.finish();
    self.frame.fadeOut(100);
  }

  self.attachFrame = function (node) {
    var offset = GetAbsoluteOffset(node);
    // TODO(hungte) Remove jquery -- although height() is hard to replace.
    var node_height = $(node).height();
    offset.node_height = node_height;
    self.moveFrame(offset);
  }

  function getPageHeight() {
    var b = document.body;
    var e = document.documentElement;
    return Math.max(b.scrollHeight, e.scrollHeight,
        b.offsetHeight, e.offsetHeight,
        b.clientHeight, e.clientHeight);
  }

  function getPageWidth() {
    var b = document.body;
    var e = document.documentElement;
    return Math.max(b.scrollWidth, e.scrollWidth,
        b.offsetWidth, e.offsetWidth,
        b.clientWidth, e.clientWidth);
  }

  self.moveFrame = function (offset) {
    if (IsChildFrame())
      return SendFrameMessage(window.parent, 'move', offset);

    self.debug("moveFrame, orig:", offset);

    // Recalculate where is the best place to show IME frame, to prevent moving
    // that outside top level DOM (ex, chat windows).
    var min_width = 300, min_height = 150;
    if (offset.top + offset.node_height + min_height > getPageHeight())
      offset.top -= min_height;
    else
      offset.top += offset.node_height;

    if (offset.left + min_width > getPageWidth())
      offset.left = getPageWidth() - min_width;
    else
      offset.left += 5;
    self.debug("moveFrame, page wXH:", getPageWidth(), getPageHeight(),
               ", final:", offset);

    self.frame.css(offset);
  }

  self.setInitNode = function (node) {
    self.init_node = node;
  }

  InitContent();
};
