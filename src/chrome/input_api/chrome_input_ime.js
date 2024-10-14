// Copyright 2013 Google Inc. All Rights Reserved.

/**
 * @fileoverview JavaScript emulation for chrome.input.ime.*.
 * @author hungte@google.com (Hung-Te Lin)
 */

import { AddLogger } from "../jscin/logger.js";
const {log, debug, info, warn, error, assert, trace} = AddLogger("chrome_input_ime");

export class ChromeInputIME {

  constructor() {
    // Internal variables
    this.contextIndex = 0;
    this.kDefaultEngineId = 'Emulation';
    this.isEmulation = true;

    this.kEventPrefix = 'chrome.input.ime#';
    this.kEarlyAbortEvents = ['KeyEvent'];  // Return true to abort.

    this.onActivate = this.CreateEventHandler("Activate");
    this.onDeactivated = this.CreateEventHandler("Deactivated");
    this.onBlur = this.CreateEventHandler("Blur");
    this.onFocus = this.CreateEventHandler("Focus");
    this.onInputContextUpdate = this.CreateEventHandler("InputContextUpdate");
    this.onKeyEvent = this.CreateEventHandler("KeyEvent");
    this.onCandidateClicked = this.CreateEventHandler("CandidateClicked");
    this.onMenuItemActivated = this.CreateEventHandler("MenuItemActivated");
    this.onSurroundingTextChanged = this.CreateEventHandler("SurroundingTextChanged");
    this.onReset = this.CreateEventHandler("Reset");

    // Implementation events.
    this.onUiMenu = this.CreateEventHandler("UiMenu");
    this.onUiCandidates = this.CreateEventHandler("UiCandidates");
    this.onUiCandidateWindow = this.CreateEventHandler("UiCandidateWindow");
    this.onUiComposition = this.CreateEventHandler("UiComposition");
    this.onImplCommitText = this.CreateEventHandler("ImplCommitText");
    this.onImplCommit = this.CreateEventHandler("ImplCommit");
    this.onImplFocus = this.CreateEventHandler("ImplFocus");
    this.onImplBlur = this.CreateEventHandler("ImplBlur");
    this.onImplUpdateUI = this.CreateEventHandler("ImplUpdateUI");
    this.onImplAcceptedKeys = this.CreateEventHandler("ImplAcceptedKeys");

    this.Initialize();
  }

  // Internal Functions

  GetContext(contextID) {
    return this.context_list[contextID];
  }

  DeleteContext(contextID) {
    delete this.context_list[contextID];
  }

  GetEngineContext() {
    return this.engineContext;
  }

  CreateEngineContext(engineID) {
    return {
      engineID: engineID,
      menuitems: [],
      candidate_window: {
        visible: false,
        cursorVisible: false,
        vertical: false,
        pageSize: 0,
        auxiliaryText: undefined,
        auxiliaryTextVisible:  false,
        windowPosition: "cursor"
      }
    };
  }

  CreateContext() {
    this.contextIndex += 1;
    return {
      // InputContext
      contextID: this.contextIndex,
      type: 'text',

      candidates: [],

      composition: {
        text: '',
        selectionStart: 0,
        selectionEnd: 0,
        cursor: 0
      }
    };
  }

  CreateUIEvent(type, context, engine) {
    return { type: type,
             context: context,
             engine: engine };
  }

  EnterContext() {
    debug("EnterContext");
    let context = this.CreateContext();
    this.context_list[context.contextID] = context;
    debug(context);
    return { contextID: context.contextID, type: context.type };
  }

  LeaveContext(contextID) {
    debug("LeaveContext()");
    this.DeleteContext(contextID);
  }

  SetDefinedParams(dest, src) {
    let i;
    for (i = 2; i < arguments.length; i++) {
      let param_name = arguments[i];
      if (param_name in src)
        dest[param_name] = src[param_name];
    }
  };

  CreateEventHandler(event_name) {
    let needEarlyAbort = this.kEarlyAbortEvents.includes(event_name);
    return { addListener: (callback) => {
      document.addEventListener(
          this.kEventPrefix + event_name,
          (ime_ev) => {
            debug('on', event_name, ime_ev);
            let result = callback(...ime_ev.detail);
            if (needEarlyAbort && result) {
              ime_ev.preventDefault();
            }
            return result;
          }, false);
    } };
  }

  // public functions

  dispatchEvent(type, ...params) {
    let imeEvent = new CustomEvent(this.kEventPrefix + type);
    debug("dispatchEvent", type, params);
    imeEvent.initCustomEvent(imeEvent.type, false,
        this.kEarlyAbortEvents.includes(type), params);
    return document.dispatchEvent(imeEvent);
  };

  // chrome.input.ime API

  setComposition(parameters, callback) {
    debug('setComposition');
    let context = this.GetContext(parameters.contextID);
    if (!context) {
      debug("Invalid context ID:", parameters.contextID);
      return;
    }
    this.SetDefinedParams(context.composition, parameters,
        'text', 'selectionStart', 'selectionEnd', 'cursor', 'segments');
    this.dispatchEvent("UiComposition", context);
  };

  clearComposition(parameters, callback) {
    debug('clearComposition');
    let context = this.GetContext(parameters.contextID);
    if (!context) {
      debug("Invalid context ID:", parameters.contextID);
      return;
    }
    context.composition.text = '';
    context.composition.selectionStart = 0;
    context.composition.selectionEnd = 0;
    context.composition.cursor = 0;
    context.composition.segments = [];
    this.dispatchEvent("UiComposition", context);
  };

  commitText(parameters, callback) {
    debug('commitText', parameters);
    this.dispatchEvent("ImplCommitText", parameters.contextID, parameters.text);
  };

  setCandidateWindowProperties(parameters, callback) {
    let engine = this.GetEngineContext(parameters.engineID);
    debug('setCandidateWindowProperties', parameters);
    this.SetDefinedParams(engine.candidate_window, parameters.properties,
        'visible', 'cursorVisible', 'vertical', 'pageSize', 'auxiliaryText',
        'auxiliaryTextVisible', 'windowPosition');
    this.dispatchEvent("UiCandidateWindow", engine);
  };

  setCandidates(parameters, callback) {
    debug('setCandidates');
    let context = this.GetContext(parameters.contextID);
    if (!context) {
      debug("Invalid context ID:", parameters.contextID);
      return;
    }
    context.candidates = parameters.candidates;
    this.dispatchEvent("UiCandidates", context);
  };

  setCursorPosition(parameters, callback) {
    throw "not implemented, sorry";
  };

  setMenuItems(parameters, callback) {
    debug('setMenuItems');
    let engine = this.GetEngineContext(parameters.engineID);
    engine.menuitems = parameters.items;
    this.dispatchEvent("UiMenu", engine);
  };

  updateMenuItems(parameters, callback) {
    // Currently Chrome implements updateMenuItems in same way as setMenuItems.
    return this.setMenuItems(parameters, callback);
  }

  deleteSurroundingText(parameters, callback) {
    throw "not implemented, sorry";
  };

  keyEventHandled(parameters, callback) {
    throw "not implemented, sorry";
  };

  // Initialization
  Initialize () {
    this.engineContext = this.CreateEngineContext(this.kDefaultEngineId);
    this.context_list = {};
    this.onImplFocus.addListener((token) => {
      return this.dispatchEvent("Focus", this.EnterContext(), token);
    });
    this.onImplBlur.addListener((contextID) => {
      let context = this.GetContext(contextID);
      if (!context)
        return;
      // TODO(hungte) Chain these commands so they are executed in order.
      this.dispatchEvent("Reset", contextID);
      this.dispatchEvent("Blur", contextID);
      debug("chrome.input.ime: LeaveContext.", contextID);
      this.LeaveContext(contextID);
    });
  }
}
