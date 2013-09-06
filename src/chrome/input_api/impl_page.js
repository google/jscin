// Copyright 2013 Google Inc. All Rights Reserved.

/**
 * @fileoverview Implementation bindings for attaching to web page components.
 * @author hungte@google.com (Hung-Te Lin)
 */

var ChromeInputImeImplPage = function () {
  var self = this;
  var ime_api = chrome.input.ime;
  var engineID = "chrome_input_ime#impl#page";

  self.context_list = {};

  function keyEventHandler (ev) {
    var ev2 = ImeEvent.ImeKeyEvent(ev);
    var result = ime_api.dispatchEvent("KeyEvent", engineID, ev2);
    if (!result)
      ev.preventDefault();
    return result;
  };

  self.init = function() {
    chrome.input.ime.onImplCommitText.addListener(function (contextID, text) {
      var node = self.context_list[contextID].node;
      var newSelect = node.selectionStart + text.length;
      // Assume node is either input or text area.
      node.value = (node.value.substring(0, node.selectionStart) +
        text + node.value.substring(node.selectionEnd));
      node.selectionStart = newSelect;
      node.selectionEnd = newSelect;
    });
  }

  self.attach = function (node) {
    node.addEventListener('keydown', keyEventHandler);
    node.addEventListener('keyup', keyEventHandler);
    node.addEventListener('focus', function (ev) {
      console.log("focus");
      var context = ime_api.EnterContext();
      context.node = node;
      node.setAttribute("imeContextId", context.contextID);
      self.context_list[context.contextID] = context;
      return ime_api.dispatchEvent("Focus", context);
    });
    node.addEventListener('blur', function (ev) {
      console.log("blur");
      var contextID = ev.target.getAttribute("imeContextId");
      // TODO(hungte) Remove from contex_list?
      return ime_api.dispatchEvent('Blur', contextID);
    });
  }

  return self;
};
