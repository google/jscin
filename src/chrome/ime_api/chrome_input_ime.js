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

  async clearComposition(parameters) {
    // parameters:
    // - contextID
    debug("clearComposition", parameters);
    return false;
  }

  async commitText(parameters) {
    // parameters:
    // - contextID
    // - text
    debug("commitText", parameters);
    return false;
  }

  async setCandidates(parameters) {
    // parameters:
    // - contextID
    // - candidates[]
    //   = annotation, candidate, id, label, parentId, usage{body, title}
    debug("setCandidates", parameters);
    return false;
  }

  async setCandidateWindowProperties(parameters) {
    // parameters:
    // - engineID
    // - properties
    //   = auxiliaryText, auxiliaryTextVisible, currentCandidateIndex,
    //     cursorVisible, pageSize, totalCAndidates, vertical, visible,
    //     windowPosition
    debug("setCandidateWindowProperties", parameters);
    return false;
  }

  async setComposition(parameters) {
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

  async setMenuItems(parameters) {
    // - parameters: MenuParameters
    debug("setMenuItems", parameters);
    return false;
  }

  async updateMenuItems(parameters) {
    // - parameters: MenuParameters
    debug("updateMenuItems", parameters);
    return false;
  }

  // Indicates that the key event received by onKeyEvent is handled.
  // This should only be called if the onKeyEvent listener is asynchronous.
  async keyEventHandled(requestId, response) {
    // requestId: string (from keyEvent.requestId)
    // response: boolean
    debug("keyEventHandled: NOT_IMPL", requestId, response);
  }

  async sendKeyEvents(parameters) {
    // parameters:
    // - contextID: number
    // - keyData: KeyboardEvent[]
    debug("sendKeyEvents: NOT_IMPL", parameters);
  }

  async setCursorPosition(parameters) {
    // parameters:
    // - candidateID: number
    // - contextID: number
    debug("setCursorPosition: NOT_IMPL", parameters);
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

  // The order of events:
  //  Whenever we change the state while there is still composition, onReset will be invoked.
  //  When Cltr-Space (already in an input box) -> onActivate, onFocus.
  //  When Ctrl-Space again (already activated) -> [onReset if has composition,] onDeactivated.
  //  Click into another input box -> [onReset,] onBlur, onFocus.

  onActivate = this._createEventHandler("Activate");
  onReset = this._createEventHandler("Reset");
  onBlur = this._createEventHandler("Blur");
  onFocus = this._createEventHandler("Focus");
  onDeactivated = this._createEventHandler("Deactivated");

  onCandidateClicked = this._createEventHandler("CandidateClicked");
  onInputContextUpdate = this._createEventHandler("InputContextUpdate");
  onMenuItemActivated = this._createEventHandler("MenuItemActivated");
}
