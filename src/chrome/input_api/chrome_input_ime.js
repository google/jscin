// Copyright 2013 Google Inc. All Rights Reserved.

/**
 * @fileoverview JavaScript emulation for chrome.input.ime.*.
 * @author hungte@google.com (Hung-Te Lin)
 */

var ChromeInputIME = function () {
  var self = this;

  // Internal variables
  self._debug = true;
  self.contextIndex = 0;
  self.kDefaultEngineId = 'Emulation';
  self.isEmulation = true;

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

  function CreateUIEvent(type, context, engine) {
    return { type: type,
             context: context,
             engine: engine };
  }

  function DummyUIEventHandler(ev) {
    console.log('DummyUIEventHandler', ev.type, ev);
  }

  self.ProcessUIEvent = function (type, context, engine) {
    // Create and dispatch.
    // Known UI events: 'menu', 'candidates', 'candidate_window', 'composition'.
    self.ui_event_handler({
      type: type,
      context: context,
      engine: engine});
  };

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

  self.attach = function (node) {
    var engine = GetEngineContext();
    var keyEventHandler = function(ev) {
      var ev2 = ImeEvent.ImeKeyEvent(ev);
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

  self.attachImeExtensionIpc = function (ipc) {
    // ipc must be a ImeEvent.ImeExtensionIPC object.
    if (!ipc) {
      ipc = new ImeEvent.ImeExtensionIPC('background');
    }
    self.ipc = ipc;
    ipc.recv(function(type) {
      if (type == 'Focus') {
        // We need to create a context for this.
        self.dispatchEvent('Focus', EnterContext(ipc));
      } else {
        self.dispatchEvent.apply(self, arguments);
      }
    });
    self.setUserInterfaceEventHandler(function (msg) {
      if (!self.ipc)
        return;
      self.ipc.send('UIEvent', msg);
    });
  }

  self.setUserInterfaceEventHandler = function (handler) {
    self.log("UI handlers changed to:", handler);
    self.ui_event_handler = handler;
  }

  self.dispatchEvent = function (type) {
    var params = Array.prototype.slice.call(arguments, 1);
    var imeEvent = new CustomEvent(kEventPrefix + type);
    self.log("dispatchEvent", type, arguments);
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
    self.ProcessUIEvent("composition", context, undefined);
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
    self.ProcessUIEvent("composition", context, undefined);
  };

  self.commitText = function (parameters, callback) {
    self.debug('commitText');
    var context = GetContext(parameters.contextID);
    if (!context) {
      self.debug("Invalid context ID:", parameters.contextID);
      return;
    }
    var node = context.node;
    if ('send' in node) {
      node.send("commitText", parameters);
    } else {
      // Assume node is a DOM node.
      node.value = (node.value.substring(0, node.selectionStart) +
          parameters.text +
          node.value.substring(node.selectionEnd));
    }
  };

  self.setCandidateWindowProperties = function (parameters, callback) {
    var engine = GetEngineContext(parameters.engineID);
    self.debug('setCandidateWindowProperties', parameters);
    SetDefinedParams(engine.candidate_window, parameters.properties,
        'visible', 'cursorVisible', 'vertical', 'pageSize', 'auxiliaryText',
        'auxiliaryTextVisible', 'windowPosition');
    self.ProcessUIEvent("candidate_window", undefined, engine);
  };

  self.setCandidates = function (parameters, callback) {
    self.debug('setCandidates');
    var context = GetContext(parameters.contextID);
    if (!context) {
      self.debug("Invalid context ID:", parameters.contextID);
      return;
    }
    context.candidates = parameters.candidates;
    self.ProcessUIEvent("candidates", context, undefined);
  };

  self.setCursorPosition = function (parameters, callback) {
    throw "not implemented, sorry";
  };

  self.setMenuItems = function (parameters, callback) {
    self.debug('setMenuItems');
    var engine = GetEngineContext(parameters.engineID);
    engine.menuitems = parameters.items;
    self.ProcessUIEvent("menu", undefined, engine);
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
    self.ui_event_handler = DummyUIEventHandler;
    self.context_list = {};
  }

  Initialize();
}
