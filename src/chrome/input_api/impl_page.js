// Copyright 2013 Google Inc. All Rights Reserved.

/**
 * @fileoverview Implementation bindings for attaching to web page components.
 * @author hungte@google.com (Hung-Te Lin)
 */

export class ChromeInputImeImplPage {

  constructor(ime_api) {
    this.ime_api = ime_api;
    this.engineID = "this.ime_api#impl#page";
    this.contexts = {};
  }

  keyEventHandler (ev) {
    let result = this.ime_api.dispatchEvent("KeyEvent", this.engineID, ev);
    if (!result)
      ev.preventDefault();
    return result;
  }

  init() {
    this.ime_api.onImplCommitText.addListener((contextID, text) => {
      let node = this.contexts[contextID].node;
      let newSelect = node.selectionStart + text.length;
      // Assume node is either input or text area.
      node.value = (node.value.substring(0, node.selectionStart) +
        text + node.value.substring(node.selectionEnd));
      node.selectionStart = newSelect;
      node.selectionEnd = newSelect;
    });
    this.ime_api.onFocus.addListener((context) => {
      context.node = this.node;
      this.contexts[context.contextID] = context;
      this.node.setAttribute("imeContextId", context.contextID);
    });
  }

  attach(node) {
    node.addEventListener('keydown', this.keyEventHandler.bind(this));
    node.addEventListener('keyup', this.keyEventHandler.bind(this));
    node.addEventListener('focus', (ev) => {
      console.debug("[impl_page] focus", ev);
      this.node = node;
      return this.ime_api.dispatchEvent("ImplFocus");
    });
    node.addEventListener('blur', (ev) => {
      console.debug("[impl_page] blur", ev);
      let contextID = ev.target.getAttribute("imeContextId");
      delete this.contexts[contextID];
      return this.ime_api.dispatchEvent('Blur', contextID);
    });
  }
}
