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
  ime_api.onImplAcceptedKeys.addListener(function (keys) {
    ipc.send("ImplAcceptedKeys", keys);
  });

  ipc.listen({
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

    var ev2 = ImeEvent.ImeKeyEvent(ev);
    var node = ev.target;
    self.debug("impl.KeyDownEventHandler", ev, ev2);
    if (self.im_accepted_keys) {
      // Serialize ev2.key
      var k = jscin.get_key_val(ev2.code);
      if (ev2.shiftKey)
        k = 'Shift ' + k;
      if (ev2.altKey)
        k = 'Alt ' + k;
      if (ev2.ctrlKey)
        k = 'Ctrl ' + k;

      if (self.im_accepted_keys.indexOf(k) >= 0) {
        ev.preventDefault();
        ev.stopPropagation();
        SendMessage('KeyEvent', self.engineID, ev2);
      }
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
      SendMessage("Blur", self.contextID);
      self.contextID = undefined;
    }
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

      ImplCommitText: function (contextID, text) {
        if (contextID != self.contextID)
          return;
        ImplCommitText(self.node, text);
      },

      ImplAcceptedKeys: function (keys) {
        self.im_accepted_keys = keys;
      },

      Focus: function (context, guid) {
        if (guid != self.guid)
          return;
        var node = self.node;
        self.contextID = context.contextID;

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
      ListenEvents();
    });
  }

  function IsEditableNode(node) {
    return node && (node.nodeName == 'INPUT' || node.nodeName == 'TEXTAREA' ||
                    node.getAttribute('contenteditable'));
  }

  function IsAttached(node) {
    return self.attached.indexOf(node) >= 0;
  }

  function ListenEvents() {
    document.addEventListener("keydown", function (ev) {
      if (ev.target != self.node)
        return;
      return KeyDownEventHandler(ev);
    }, true);
    document.addEventListener("keyup", function (ev) {
      if (ev.target != self.node)
        return;
      return KeyUpEventHandler(ev);
    }, true);
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
