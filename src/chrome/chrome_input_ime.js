// Copyright 2013 Google Inc. All Rights Reserved.

/**
 * @fileoverview JavaScript emulation for chrome.input.ime.*.
 * @author hungte@google.com (Hung-Te Lin)
 */

ChromeInputIME = function () {
  var self = this;

  // Internal variables
  self._debug = true;
  self.contextIndex = 0;
  self.kDefaultEngineId = 'Emulation';

  // Internal Functions

  self.log = function() {
    console.log.apply(console, arguments);
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

  function CreateContext(node) {
    self.contextIndex += 1;
    return {
      // InputContext
      contextID: self.contextIndex,
      type: 'text',

      node: node,
      candidates: [],

      composition: {
        text: '',
        selectionStart: 0,
        selectionEnd: 0,
        cursor: 0
      }
    };
  }

  function CreateDummyUserInterface() {
    function DummyHandler(name, arg) {
      return function (ui_context) {
        self.log("DummyUI:", name, arg, ui_context);
      }
    }
    return {
      // functions taking engine as input
      menu: DummyHandler("menu", "engine"),
      candidates_window: DummyHandler("candidates_window", "engine"),
      // functions taking context as input
      composition: DummyHandler("composition", "context"),
      candidates: DummyHandler("candidates", "context"),
    };
  }

  function JsKeyCode2Key(k) {
    // The KeyboardEvent by browser uses "JavaScript Key Code" and is different
    // from Chrome Extension key names. Ref:
    // http://www.cambiaresearch.com/articles/15/javascript-char-codes-key-codes
    switch (k) {
      case 8:
        return 'Backspace';
      case 37:
        return 'Left';
      case 38:
        return 'Up';
      case 39:
        return 'Right';
      case 40:
        return 'Down';
      case 27:
        return 'Esc';
      case 186:
        return ';';
      case 187:
        return '=';
      case 188:
        return ',';
      case 189:
        return '-';
      case 190:
        return '.';
      case 191:
        return '/';
      case 192:
        return '`';
      case 219:
        return '{';
      case 220:
        return '\\';
      case 221:
        return '}';
      case 222:
        return "'";
    };
    return String.fromCharCode((96 <= k && k <= 105) ? k - 48 : k);
  }

  // The real W3C KeyboardEvent is slightly different from the KeyboardEvent
  // expected in Chrome Extension input API, so let's make a mini
  // implementation.
  function ImeKeyEvent(ev) {
    return {
      altKey: ev.altKey,
      ctrlKey: ev.ctrlKey,
      shiftKey: ev.shiftKey,
      type: ev.type,
      key: JsKeyCode2Key(ev.keyCode),
      code: ev.keyCode,
    };
  }

  function EnterContext(node) {
    self.debug("EnterContext:", node);
    var context = CreateContext(node);
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
            self.debug('on', event_name);
            var result = callback.apply(null, ime_ev.detail);
            if (needEarlyAbort && result) {
              ime_ev.preventDefault();
            }
            return result;
          }, false);
    } };
  }

  // public functions

  self.attach = function (node) {
    var engine = GetEngineContext();
    var keyEventHandler = function(ev) {
      var ev2 = ImeKeyEvent(ev);
      self.debug("<attach>", ev.type, ev2);
      var result = self.dispatchEvent("KeyEvent", engine.engineID, ev2);
      if (!result)
        ev.preventDefault();
      self.debug("result:", result);
      return result;
    };
    node.addEventListener('keydown', keyEventHandler);
    node.addEventListener('keyup', keyEventHandler);

    node.addEventListener('focus', function(ev) {
      var result = self.dispatchEvent("Focus", EnterContext(node));
      return result;
    });
    node.addEventListener('blur', function(ev) {
      var context = GetContext();
      if (context == null)
        return;
      var result = self.dispatchEvent('Blur', GetContext().contextID);
      LeaveContext();
      return result;
    });
  };

  self.setUserInterfaceHandlers = function(ui) {
    self.log("UI handlers changed to:", ui);
    self.ui = ui;
  }

  self.dispatchEvent = function (type) {
    var params = Array.prototype.slice.call(arguments, 1);
    var imeEvent = new CustomEvent(kEventPrefix + type);
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
        'text', 'selectionStart', 'selectionEnd', 'cursor');
    self.ui.composition(context);
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
    self.ui.composition(context);
  };

  self.commitText = function (parameters, callback) {
    self.debug('commitText');
    var context = GetContext(parameters.contextID);
    if (!context) {
      self.debug("Invalid context ID:", parameters.contextID);
      return;
    }
    var node = context.node;
    node.value = (node.value.substring(0, node.selectionStart) +
                  parameters.text +
                  node.value.substring(node.selectionEnd));
  };

  self.setCandidateWindowProperties = function (parameters, callback) {
    var engine = GetEngineContext(parameters.engineID);
    self.debug('setCandidateWindowProperties', parameters);
    SetDefinedParams(engine.candidate_window, parameters.properties,
        'visible', 'cursorVisible', 'vertical', 'pageSize', 'auxiliaryText',
        'auxiliaryTextVisible', 'windowPosition');
    self.ui.candidates_window(engine);
  };

  self.setCandidates = function (parameters, callback) {
    self.debug('setCandidates');
    var context = GetContext(parameters.contextID);
    if (!context) {
      self.debug("Invalid context ID:", parameters.contextID);
      return;
    }
    context.candidates = parameters.candidates;
    self.ui.candidates(context);
  };

  self.setCursorPosition = function (parameters, callback) {
    throw "not implemented, sorry";
  };

  self.setMenuItems = function (parameters, callback) {
    self.debug('setMenuItems');
    var engine = GetEngineContext(parameters.engineID);
    engine.menuitems = parameters.items;
    self.ui.menu(engine);
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
  self.onKeyEvent = CreateEventHandler("KeyEvent", true);
  self.onCandidateClicked = CreateEventHandler("CandidateClicked");
  self.onMenuItemActivated = CreateEventHandler("MenuItemActivated");
  self.onSurroundingTextChanged = CreateEventHandler("SurroundingTextChanged");
  self.onReset = CreateEventHandler("Reset");

  // Initialization
  function Initialize () {
    self.engineContext = CreateEngineContext(self.kDefaultEngineId);
    self.context_list = {};
    self.ui = CreateDummyUserInterface();
  }

  Initialize();
}
