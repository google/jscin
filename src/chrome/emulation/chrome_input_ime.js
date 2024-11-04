// Copyright 2013 Google Inc. All Rights Reserved.

/**
 * @fileoverview A Chrome browser implementation for chrome.input.ime.
 * @author hungte@google.com (Hung-Te Lin)
 */

import { AddLogger } from "../jscin/logger.js";
const {log, debug, info, warn, error, assert, trace} = AddLogger("chrome.input.ime");

export class ChromeInputIme {

  constructor() {
    this.engineID = "jscin.chrome.input.ime";
    this.callbacks = {};
    this.contexts = {};
  }

  // Types
  KeyboardEvent(altKey, capsLock, code, ctrlKey, extensionId, key, shiftKey) {
    return {altKey, capsLock, code, ctrlKey, extensionId, key, shiftKey};
  }

  MenuItem(checked, enabled, id, label, style, visible) {
    return{checked, enabled, id, label, style, visible};
  }

  // Each item i  the items is a MenuItem.
  MenuParameters(engineId, items) {
    return {engineId, items};
  }

  // chrome.input.ime API

  clearComposition(parameters, callback) {
    // parameters:
    // - contextID
    debug("clearComposition", parameters);
    return false;
  }

  commitText(parameters, callback) {
    // parameters:
    // - contextID
    // - text
    debug("commitText", parameters);
    return false;
  }

  setCandidates(parameters, callback) {
    // parameters:
    // - contextID
    // - candidates[]
    //   = annotation, candidate, id, label, parentId, usage{body, title}
    debug("setCandidates", parameters);
    return false;
  }

  setCandidateWindowProperties(parameters, callback) {
    // parameters:
    // - engineID
    // - properties
    //   = auxiliaryText, auxiliaryTextVisible, currentCandidateIndex,
    //     cursorVisible, pageSize, totalCAndidates, vertical, visible,
    //     windowPosition
    debug("setCandidateWindowProperties", parameters);
    return false;
  }

  setComposition(parameters, callback) {
    // parameters:
    // - contextID
    // - cursor
    // - segments
    //   = end, start, style
    // - selectionEnd
    // - selectionStart
    // - text
    debug("setComposition", parameters);
    return false;
  }

  setMenuItems(parameters, callback) {
    // - parameters: MenuParameters
    debug("setMenuItems", parameters);
    return false;
  }

  updateMenuItems(parameters, callback) {
    // - parameters: MenuParameters
    debug("updateMenuItems", parameters);
    return false;
  }

  // events
  createEventHandler(event) {
    return {
      addListener: (c) => {
        if (!(event in this.callbacks)) {
          this.callbacks[event] = []
        }
        this.callbacks[event].push(c)
      },
      dispatch: (...args) => {
        let cbs = this.callbacks[event] || [];
        let r;
        for (let c of cbs) {
          r = c(...args);
        }
        return r;
      }
    };
  }

  dispatchEvent(name, ...args) {
    let dispatcher = this[`on${name}`].dispatch;
    return dispatcher(...args);
  }

  onActivate = this.createEventHandler("Activate");
  onBlur = this.createEventHandler("Blur");
  onCandidateClicked = this.createEventHandler("CandidateClicked");
  onDeactivated = this.createEventHandler("Deactivated");
  onFocus = this.createEventHandler("Focus");
  onInputContextUpdate = this.createEventHandler("InputContextUpdate");
  onKeyEvent = this.createEventHandler("KeyEvent");
  onMenuItemActivated = this.createEventHandler("MenuItemActivated");
  onReset = this.createEventHandler("Reset");
}
