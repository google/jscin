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
  self.debug = false;
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
    var node = ev.target;
    self.log("IME.KeyDownEventHandler", ev, ev2);

    // Simulation by SnapshotIME.
    if (self.im) {
      switch (self.im.onKeystroke(self.imctx, ev2)) {
        case jscin.IMKEY_COMMIT:
        case jscin.IMKEY_ABSORB:
          ev.preventDefault();
          break;
        case jscin.IMKEY_IGNORE:
        default:
          break;
      }
      self.SendMessage("KeyEvent", self.engineID, ev2);
      return;
    }

    // TODO(hungte) Due to browser design, we can't find a better way to re-fire
    // keyboard events if the IPC message responds "absorb or ignore". Woakround
    // here is to preserve input element state. Another way is to call jscin
    // directly (see SnapshotIME).
    // Note due to JavaScript event model, the return value is always retrieved
    // before ImplCommitText event is received so we don't need to hack in
    // commitText.
    var state = {
      value: node.value,
      selectionStart: node.selectionStart,
      selectionEnd: node.selectionEnd
    };

    self.SendMessage("KeyEvent", self.engineID, ev2, function (result) {
      self.log("KeyEvent result got:", result, state);
      if (!result) {
        node.value = state.value;
        node.selectionStart = state.selectionStart;
        node.selectionEnd = state.selectionEnd;
        self.log("Restored node state.");
      }
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

  self.CommitText = function (node, text) {
    if (node.hasAttribute("value")) {
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

  self.ImeEventHandler = function (type) {
    self.log("ImeEvent", type, arguments);
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
    } else if (type == 'ImplCommitText') {
      // contextID, text
      self.CommitText(self.node, arguments[2]);
    } else if (type == 'RefreshIME') {
      // Need to request for another snapshot.
      self.SnapshotIME();
    } else if (type == 'MenuItemActivated') {
      // (Legacy, when menu is included in iframe) forward to background.
      self.ipc.send.apply(null, arguments);
      self.SnapshotIME();
    }
  };

  self.FocusHandler = function (ev) {
    var node = ev.target;
    self.log("on focus", node);
    self.node = node;
    self.SendMessage("NewFocus");
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

  self.SnapshotIME = function () {
    self.im = undefined;
    self.imctx = undefined;
    self.SendMessage("SnapshotIME", function (result) {
      var name = result.im_name;
      self.log("Snapshot - IM:", result);
      if (!name) {
        self.log("Remote IM is not ready... good luck.");
        return;
      }
      jscin.register_input_method(name, 'GenInp', 'snapshot');
      self.imctx = result.imctx;
      self.im = jscin.create_input_method(name, {}, result.im_data);
    });
  }

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

  $('[contenteditable]').each(function (i) {
    var node = this;
    if (targets.indexOf(node) < 0)
      targets.push(node);
  });

  if (!targets.length)
    return;

  var ime = new IME;
  ime.log("Installing extension IME, input elements:", targets.length);
  ime.InstallIPC();
  ime.SnapshotIME();

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

  // Also attach to dynamic nodes. Currently only works for gmail composition.
  document.addEventListener("DOMNodeInserted", function (ev) {
    var node = ev.relatedNode;
    if (node.tagName.toLowerCase() == 'input' ||
        node.tagName.toLowerCase() == 'textarea' ||
        node.getAttribute('contenteditable')) {
      ime.log("got new input node", ev);
      node.addEventListener("focus", ime.FocusHandler);
      node.addEventListener("blur", ime.BlurHandler);
    }
  }, true);

}

// For content.js we can't wait for readystatechange - that is controlled by
// manifest:run_at.
init();
