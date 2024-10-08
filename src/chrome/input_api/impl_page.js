// Copyright 2013 Google Inc. All Rights Reserved.

/**
 * @fileoverview Implementation bindings for attaching to web page components.
 * @author hungte@google.com (Hung-Te Lin)
 */

import { ImeEvent } from "./ime_event.js";

export var ChromeInputImeImplPage = function () {
  var self = this;
  var ime_api = chrome.input.ime;
  var engineID = "chrome_input_ime#impl#page";

  self.contexts = {};

  function keyEventHandler (ev) {
    var ev2 = ImeEvent.ImeKeyEvent(ev);
    var result = ime_api.dispatchEvent("KeyEvent", engineID, ev2);
    if (!result)
      ev.preventDefault();
    return result;
  };

  self.init = function() {
    chrome.input.ime.onImplCommitText.addListener(function (contextID, text) {
      var node = self.contexts[contextID].node;
      var newSelect = node.selectionStart + text.length;
      // Assume node is either input or text area.
      node.value = (node.value.substring(0, node.selectionStart) +
        text + node.value.substring(node.selectionEnd));
      node.selectionStart = newSelect;
      node.selectionEnd = newSelect;
    });
    chrome.input.ime.onFocus.addListener(function (context) {
      context.node = self.node;
      self.contexts[context.contextID] = context;
      self.node.setAttribute("imeContextId", context.contextID);
    });
  }

  self.attach = function (node) {
    node.addEventListener('keydown', keyEventHandler);
    node.addEventListener('keyup', keyEventHandler);
    node.addEventListener('focus', function (ev) {
      console.log("focus");
      self.node = node;
      return ime_api.dispatchEvent("ImplFocus");
    });
    node.addEventListener('blur', function (ev) {
      console.log("blur");
      var contextID = ev.target.getAttribute("imeContextId");
      delete self.contexts[contextID];
      return ime_api.dispatchEvent('Blur', contextID);
    });
  }

  return self;
};
