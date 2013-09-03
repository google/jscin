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

  self.log = function () {
    if (!self.debug)
      return;
    console.log.apply(console, arguments);
  }

  self.SendMessage = function () {
    self.ipc.send.apply(null, arguments);
  };

  self.KeyEventHandler = function (ev) {
    var ev2 = ImeEvent.ImeKeyEvent(ev);
    // TODO(hungte) How do we wait and check return value?
    var result = self.SendMessage("KeyEvent", self.engineID, ev2);
    self.log("ImeKeyEventHandler", ev2, ", result=", result);
    if (!result)
      ev.preventDefault();
    return result;
  };

  self.AttachKeyEvents = function (node) {
    node.addEventListener('keydown', self.KeyEventHandler);
    node.addEventListener('keyup', self.KeyEventHandler);
  };

  self.DetachKeyEvents = function (node) {
    node.removeEventListener('keydown', self.KeyEventHandler);
    node.removeEventListener('keyup', self.KeyEventHandler);
  };

  self.ImeEventHandler = function (type) {
    if (type == 'UIReady') {
      // Delayed init.
      if (self.init_node)
        self.FocusHandler({target: self.init_node});
      self.init_node = undefined;
    } else if (type == 'Focus') {
      var context = arguments[1];
      var node = self.node;
      self.contextID = context.contextID;
      self.AttachKeyEvents(node);
      var offset = $(node).offset();
      offset.left += 10;
      offset.top += $(node).height();
      self.frame.css(offset).fadeIn(250);
    } else if (type == 'commitText') {
      var parameters = arguments[1];
      var node = self.node;
      var newpos = node.selectionStart + parameters.text.length;
      // TODO selctionStart seems wrong after changing node.value...
      node.value = (node.value.substring(0, node.selectionStart) +
          parameters.text +
          node.value.substring(node.selectionEnd));
      node.selectionStart = newpos;
      node.selectionEnd = newpos;
    } else if (type == 'MenuItemActivated') {
      // forward to background.
      self.ipc.send.apply(null, arguments);
    }
  };

  self.FocusHandler = function (ev) {
    self.log("on focus");
    var node = ev.target;
    self.node = ev.target;
    self.SendMessage("Activate"); // hack: we want to update menu.
    self.SendMessage("Focus");
  };

  self.BlurHandler = function (ev) {
    if (self.contextID) {
      self.log("on blur", self.contextID);
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

document.addEventListener('readystatechange', function() {
  // TODO(hungte) Bind on "interactive" gets us early access to input
  // components, but on 'complete' we may need to parse again.
  if (document.readyState != 'complete')
    return;

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

});
