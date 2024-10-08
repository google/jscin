// Copyright 2013 Google Inc. All Rights Reserved.

/**
 * @fileoverview JavaScript emulation for chrome.input.ime.*.
 * @author hungte@google.com (Hung-Te Lin)
 */

export var ChromeInputIME = function () {
  var self = this;

  // Internal variables
  self._debug = false;
  self.contextIndex = 0;
  self.kDefaultEngineId = 'Emulation';
  self.isEmulation = true;

  // Internal Functions

  self.log = function() {
    console.log.apply(console, ["[chrome.input.ime]"].concat(
        Array.prototype.slice.apply(arguments)));
  }

  self.debug = function() {
    if (self._debug) {
      self.log.apply(self, arguments);
    }
  }

  function GetContext(contextID) {
    return self.context_list[contextID];
  }

  function DeleteContext(contextID) {
    delete self.context_list[contextID];
  }

  function GetEngineContext() {
    return self.engineContext;
  }

  function CreateEngineContext(engineID) {
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

  function CreateContext() {
    self.contextIndex += 1;
    return {
      // InputContext
      contextID: self.contextIndex,
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

  function CreateUIEvent(type, context, engine) {
    return { type: type,
             context: context,
             engine: engine };
  }

  function EnterContext() {
    self.debug("EnterContext");
    var context = CreateContext();
    self.context_list[context.contextID] = context;
    self.debug(context);
    return { contextID: context.contextID, type: context.type };
  }

  function LeaveContext(contextID) {
    self.debug("LeaveContext()");
    DeleteContext(contextID);
  }

  function SetDefinedParams(dest, src) {
    var i;
    for (i = 2; i < arguments.length; i++) {
      var param_name = arguments[i];
      if (param_name in src)
        dest[param_name] = src[param_name];
    }
  };

  var kEventPrefix = 'chrome.input.ime#';
  var kEarlyAbortEvents = ['KeyEvent'];  // Return true to abort.

  function CreateEventHandler(event_name) {
    var needEarlyAbort = (kEarlyAbortEvents.indexOf(event_name) >= 0);
    return { addListener: function (callback) {
      document.addEventListener(
          kEventPrefix + event_name,
          function (ime_ev) {
            self.debug('on', event_name, ime_ev);
            var result = callback.apply(null, ime_ev.detail);
            if (needEarlyAbort && result) {
              ime_ev.preventDefault();
            }
            return result;
          }, false);
    } };
  }

  // public functions

  self.dispatchEvent = function (type) {
    var params = Array.prototype.slice.call(arguments, 1);
    var imeEvent = new CustomEvent(kEventPrefix + type);
    self.debug("dispatchEvent", type, arguments);
    imeEvent.initCustomEvent(imeEvent.type, false,
        (kEarlyAbortEvents.indexOf(type) >= 0), params);
    return document.dispatchEvent(imeEvent);
  };

  // chrome.input.ime API

  self.setComposition = function (parameters, callback) {
    self.debug('setComposition');
    var context = GetContext(parameters.contextID);
    if (!context) {
      self.debug("Invalid context ID:", parameters.contextID);
      return;
    }
    SetDefinedParams(context.composition, parameters,
        'text', 'selectionStart', 'selectionEnd', 'cursor', 'segments');
    self.dispatchEvent("UiComposition", context);
  };

  self.clearComposition = function (parameters, callback) {
    self.debug('clearComposition');
    var context = GetContext(parameters.contextID);
    if (!context) {
      self.debug("Invalid context ID:", parameters.contextID);
      return;
    }
    context.composition.text = '';
    context.composition.selectionStart = 0;
    context.composition.selectionEnd = 0;
    context.composition.cursor = 0;
    context.composition.segments = [];
    self.dispatchEvent("UiComposition", context);
  };

  self.commitText = function (parameters, callback) {
    self.debug('commitText', parameters);
    self.dispatchEvent("ImplCommitText", parameters.contextID, parameters.text);
  };

  self.setCandidateWindowProperties = function (parameters, callback) {
    var engine = GetEngineContext(parameters.engineID);
    self.debug('setCandidateWindowProperties', parameters);
    SetDefinedParams(engine.candidate_window, parameters.properties,
        'visible', 'cursorVisible', 'vertical', 'pageSize', 'auxiliaryText',
        'auxiliaryTextVisible', 'windowPosition');
    self.dispatchEvent("UiCandidateWindow", engine);
  };

  self.setCandidates = function (parameters, callback) {
    self.debug('setCandidates');
    var context = GetContext(parameters.contextID);
    if (!context) {
      self.debug("Invalid context ID:", parameters.contextID);
      return;
    }
    context.candidates = parameters.candidates;
    self.dispatchEvent("UiCandidates", context);
  };

  self.setCursorPosition = function (parameters, callback) {
    throw "not implemented, sorry";
  };

  self.setMenuItems = function (parameters, callback) {
    self.debug('setMenuItems');
    var engine = GetEngineContext(parameters.engineID);
    engine.menuitems = parameters.items;
    self.dispatchEvent("UiMenu", engine);
  };

  // Currently Chrome implements updateMenuItems in same way as setMenuItems.
  self.updateMenuItems = self.setMenuItems;

  self.deleteSurroundingText = function (parameters, callback) {
    throw "not implemented, sorry";
  };

  self.keyEventHandled = function (parameters, callback) {
    throw "not implemented, sorry";
  };

  self.onActivate = CreateEventHandler("Activate");
  self.onDeactivated = CreateEventHandler("Deactivated");
  self.onBlur = CreateEventHandler("Blur");
  self.onFocus = CreateEventHandler("Focus");
  self.onInputContextUpdate = CreateEventHandler("InputContextUpdate");
  self.onKeyEvent = CreateEventHandler("KeyEvent");
  self.onCandidateClicked = CreateEventHandler("CandidateClicked");
  self.onMenuItemActivated = CreateEventHandler("MenuItemActivated");
  self.onSurroundingTextChanged = CreateEventHandler("SurroundingTextChanged");
  self.onReset = CreateEventHandler("Reset");

  // Implementation events.
  self.onUiMenu = CreateEventHandler("UiMenu");
  self.onUiCandidates = CreateEventHandler("UiCandidates");
  self.onUiCandidateWindow = CreateEventHandler("UiCandidateWindow");
  self.onUiComposition = CreateEventHandler("UiComposition");
  self.onImplCommitText = CreateEventHandler("ImplCommitText");
  self.onImplCommit = CreateEventHandler("ImplCommit");
  self.onImplFocus = CreateEventHandler("ImplFocus");
  self.onImplBlur = CreateEventHandler("ImplBlur");
  self.onImplUpdateUI = CreateEventHandler("ImplUpdateUI");
  self.onImplAcceptedKeys = CreateEventHandler("ImplAcceptedKeys");

  // Initialization
  function Initialize () {
    self.engineContext = CreateEngineContext(self.kDefaultEngineId);
    self.context_list = {};
    self.onImplFocus.addListener(function (token) {
      return self.dispatchEvent("Focus", EnterContext(), token);
    });
    self.onImplBlur.addListener(function (contextID) {
      var context = GetContext(contextID);
      if (!context)
        return;
      // TODO(hungte) Chain these commands so they are executed in order.
      self.dispatchEvent("Reset", contextID);
      self.dispatchEvent("Blur", contextID);
      self.debug("chrome.input.ime: LeaveContext.", contextID);
      LeaveContext(contextID);
    });
  }

  Initialize();
}
