// Copyright 2013 Google Inc. All Rights Reserved.

/**
 * @fileoverview JSCIN for Chrome Extension, content injection.
 * @author hungte@google.com (Hung-Te Lin)
 */

function IME() {
  var self = this;

  // variables.
  self.engineID = 'croscin_content_ime';
  self.frameURL = chrome.extension.getURL('input_api/ime.html');
  self.frame = undefined;
  self.contextID = undefined;
  self.ipc = undefined;
  self.debug = false;
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

  self.ImeEventHandler = function (type) {
    if (type == 'UIReady') {
      self.log("Got", type);
      self.SendMessage("Activate"); // hack: we want to update menu.
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
      var offset = $(node).offset();
      offset.left += 10;
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
    self.log("on focus");
    var node = ev.target;
    self.node = ev.target;
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
    // TODO(hungte) Don't use jquery.
    var frame = $('<iframe/>',
        { src: self.frameURL,
          scrolling: 'no',
          frameBorder: 0,
          allowTransparency: true})
        .css({
          width: 500,
          zIndex: 999999,
          border: 0,
          padding: 0,
          height: 300,
          position: 'absolute',
          backgroundColor: 'transparent'}).hide();
    $('body').append(frame);
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

  ime.frame = ime.CreateFrame();

  var focused = document.activeElement;
  targets.forEach(function (node) {
    node.addEventListener("focus", ime.FocusHandler);
    node.addEventListener("blur", ime.BlurHandler);
    if (focused == node)
      self.init_node = node;
  });
}

// For content.js we can't wait for readystatechange - that is controlled by
// manifest:run_at.
init();
