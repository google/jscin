// Copyright 2013 Google Inc. All Rights Reserved.

/**
 * @fileoverview JSCIN for Chrome Extension, content injection.
 * @author hungte@google.com (Hung-Te Lin)
 */

// TODO(hungte) Add jscin instance to prevent async KeyEvent issue.
// TODO(hungte) Support [contenteditable]... or never.
// TODO(hungte) Load jquery on demand.

function IME() {
  var self = this;

  // variables.
  self.engineID = 'croscin_content_ime';
  self.frameURL = chrome.extension.getURL('input_api/ime.html');
  self.frame = undefined;
  self.contextID = undefined;
  self.ipc = undefined;
  self.debug = true;
  self.nodeStates = [];
  self.enabled = true;
  self.toggleHotKey = 16;  // Shift.
  self.waitForHotkey = false;

  self.log = function () {
    if (!self.debug)
      return;
    console.log.apply(console, arguments);
  }

  self.SendMessage = function () {
    self.ipc.send.apply(null, arguments);
  };

  self.KeyUpEventHandler = function (ev) {
    // Assume our IME won't do anything on key up, let's only check hotkeys.
    if (!self.waitForHotkey)
      return;

    if (ev.keyCode == self.toggleHotKey) {
      self.log("Got toggle hot key!");
      self.enabled = !self.enabled;
      if (self.enabled)
        self.frame.fadeIn(100);
      else
        self.frame.fadeOut(100);
    }
    self.waitForHotkey = false;
  }

  self.KeyDownEventHandler = function (ev) {
    if (self.waitForHotkey)
      self.waitForHotkey = false;

    if (ev.keyCode == self.toggleHotKey && !ev.ctrlKey && !ev.altKey) {
      self.log("Wait to check toggle hotkey!");
      self.waitForHotkey = true;
      // Assume our IME don't need to handle single shift key.
      return;
    }

    if (!self.enabled)
      return;

    var ev2 = ImeEvent.ImeKeyEvent(ev);
    self.log("IME.KeyDownEventHandler", ev2);
    self.SendMessage("KeyEvent", self.engineID, ev2);
    // TODO(hungte) Due to browser design, we can't find a better way to re-fire
    // keyboard events if the IPC message responds "reject... so a workaround
    // here is to preserve input element state. We really need to find better
    // way to fix this and enable preventDefault() call.
    // ev.preventDefault();
    self.nodeStates.push({
      value: ev.target.value,
      selectionStart: ev.target.selectionStart,
      selectionEnd: ev.target.selectionEnd
    });
  };

  self.AttachKeyEvents = function (node) {
    node.addEventListener('keydown', self.KeyDownEventHandler);
    node.addEventListener('keyup', self.KeyUpEventHandler);
  };

  self.DetachKeyEvents = function (node) {
    node.removeEventListener('keydown', self.KeyDownEventHandler);
    node.removeEventListener('keyup', self.KeyUpEventHandler);
  };

  self.GetAbsoluteOffset = function (node) {
    var offset = { left: 0, 'top': 0};
    while (node) {
      offset.left += node.offsetLeft;
      offset['top'] += node.offsetTop;
      node = node.offsetParent;
    }
    return offset;
  }

  self.ImeEventHandler = function (type) {
    self.log("ImeEvent", type);
    if (type == 'UIReady') {
      self.SendMessage("Activate", self.engineID); // Update menu & pageAction.
      // Delayed init.
      if (self.init_node) {
        self.log("Found init_node:", self.init_node);
        self.FocusHandler({target: self.init_node});
      }
      self.init_node = undefined;
    } else if (type == 'Focus') {
      var context = arguments[1];
      var node = self.node;
      self.contextID = context.contextID;
      self.AttachKeyEvents(node);

      var offset = self.GetAbsoluteOffset(node);
      offset.left += 5;
      // TODO(hungte) Remove jquery -- although the height() is hard to replace.
      offset.top += $(node).height();
      if (self.enabled)
        self.frame.css(offset).fadeIn(250);
    } else if (type == 'KeyEvent') {
      var result = arguments[1];
      var state = self.nodeStates.shift();
      self.log("Got KeyEvent reply!", result, state);
      if (!result) {
        var node = self.node;
        node.value = state.value;
        node.selectionStart = state.selectionStart;
        node.selectionEnd = state.selectionEnd;
        self.log("Restored node state.");
      }
    } else if (type == 'commitText') {
      // WORKAROUND commitText is usually invoked before last KeyEvent.
      // We rely on this croscin behavior to calibrate nodeStates.
      var parameters = arguments[1];
      var node = self.node;
      var src = self.nodeStates.shift() || node;
      var newpos = src.selectionStart + parameters.text.length;
      // TODO selctionStart seems wrong after changing node.value...
      node.value = (src.value.substring(0, src.selectionStart) +
          parameters.text +
          src.value.substring(src.selectionEnd));
      node.selectionStart = newpos;
      node.selectionEnd = newpos;
      self.nodeStates.unshift({
        value: node.value,
        selectionStart: node.selectionStart,
        selectionEnd: node.selectionEnd});
    } else if (type == 'MenuItemActivated') {
      // forward to background.
      self.ipc.send.apply(null, arguments);
    }
  };

  self.FocusHandler = function (ev) {
    var node = ev.target;
    self.log("on focus", node);
    self.node = node;
    self.SendMessage("Focus");
  };

  self.BlurHandler = function (ev) {
    if (self.contextID) {
      self.log("on blur", self.contextID);
      if (self.enabled)
        self.frame.fadeOut(100);
      self.DetachKeyEvents(ev.target);
      self.SendMessage("Blur", self.contextID);
      self.contextID = undefined;
    }
  };

  self.InstallIPC = function () {
    self.ipc = new ImeEvent.ImeExtensionIPC('content');
    self.ipc.attach();
    self.ipc.recv(self.ImeEventHandler);
  };

  self.CreateFrame = function () {
    var frame = document.createElement("iframe");
    frame.setAttribute("src", self.frameURL);
    frame.setAttribute("scrolling", "no");
    frame.setAttribute("frameBorder", 0);
    frame.setAttribute("allowTransparency", true);
    frame.style.zIndex = 999999;
    frame.style.border = 0;
    frame.style.padding = 0;
    frame.style.width = "30em";
    frame.style.height = "10em";
    frame.style.position = "absolute";
    frame.style.backgroundColor = "transparent";
    frame.style.display = "none";
    document.getElementsByTagName('body')[0].appendChild(frame);
    return frame;
  };
}

function init () {
  // Check chrome.input.ime availability.  The correct way is to check
  // chrome.input.ime binding but that would spew error message in console for
  // every page; so let's check userAgent instead because for right now only
  // ChromeOS supports that.
  if (window.navigator.userAgent.indexOf(' CrOS ') >= 0)
    return;

  // Check if we have any input DOM elements to attach IME.

  var i;
  var nodes;
  var targets = [];

  // TODO(hungte) Also attach to all nodes with [contenteditable]
  nodes = document.getElementsByTagName('input');
  for (i = 0; i < nodes.length; i++) {
    var type = nodes[i].type;
    if (type) {
      type = type.toLowerCase();
      if (type != "" && type != "text" && type != "search")
        continue;
    }
    targets.push(nodes[i]);
  }

  nodes = document.getElementsByTagName('textarea');
  for (i = 0; i < nodes.length; i++) {
    targets.push(nodes[i]);
  }

  if (!targets.length)
    return;

  var ime = new IME;
  ime.log("Installing extension IME, input elements:", targets.length);
  ime.InstallIPC();

  ime.frame = $(ime.CreateFrame());

  var focused = document.activeElement;
  targets.forEach(function (node) {
    node.addEventListener("focus", ime.FocusHandler);
    node.addEventListener("blur", ime.BlurHandler);
    if (focused == node) {
      ime.log("detected init node");
      ime.init_node = node;
    }
  });
}

// For content.js we can't wait for readystatechange - that is controlled by
// manifest:run_at.
init();
