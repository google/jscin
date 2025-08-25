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

  // Each item in the items is a MenuItem.
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

  // Indicates that the key event received by onKeyEvent is handled.
  // This should only be called if the onKeyEvent listener is asynchronous.
  keyEventHandled(requestId, response) {
    // requestId: string (from keyEvent.requestId)
    // response: boolean
    debug("keyEventHandled: NOT_IMPL");
  }

  sendKeyEvents(parameters) {
    // parameters:
    // - contextID: number
    // - keyData: KeyboardEvent[]
    debug("sendKeyEvents: NOT_IMPL");
  }

  setCursorPosition(parameters) {
    // parameters:
    // - candidateID: number
    // - contextID: number
    debug("setCursorPosition: NOT_IMPL");
  }

  // Meta function to help creating the event handlers.
  _createEventHandler(event, check_result) {
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
          if (check_result && r)
            break;
        }
        return r;
      }
    };
  }

  // For onKeyEvent, the callback should return true if the event was handled;
  // false if not handled, and undefined for events to be asynchronous (see
  // keyEventHandled).
  onKeyEvent = this._createEventHandler("KeyEvent", true);

  onActivate = this._createEventHandler("Activate");
  onBlur = this._createEventHandler("Blur");
  onCandidateClicked = this._createEventHandler("CandidateClicked");
  onDeactivated = this._createEventHandler("Deactivated");
  onFocus = this._createEventHandler("Focus");
  onInputContextUpdate = this._createEventHandler("InputContextUpdate");
  onMenuItemActivated = this._createEventHandler("MenuItemActivated");
  onReset = this._createEventHandler("Reset");
}
