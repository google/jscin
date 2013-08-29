// Copyright 2013 Google Inc. All Rights Reserved.

/**
 * @fileoverview JavaScript emulation for chrome.input.ime.*.
 * @author hungte@google.com (Hung-Te Lin)
 */

var _debug = true;

function debug(msg) {
  if (_debug) {
    console.log(msg);
  }
}

chrome_input_ime = function () {
  var self = this;

  // internal functions

  // Engine specific data.
  self.engineID = 'ChomeOS_Emulation';
  self.menuitems = [];
  self.context = null;
  self.candidate_window = {
    visible: false,
    cursorVisible: false,
    vertical: false,
    pageSize: 0,
    auxiliaryText: '',
    auxiliaryTextVisible:  false,
    windowPosition: "cursor"
  };

  function GetContext(contextID) {
    // TODO(hungte) Support multiple contextes.
    return self.context;
  }

  function JsKeyCode2Key(k) {
    // The KeyboardEvent by browser uses "JavaScript Key Code" and is different
    // from Chrome Extension key names. Ref:
    // http://www.cambiaresearch.com/articles/15/javascript-char-codes-key-codes
    switch (k) {
      case 8:
        return 'Backspace';
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
    debug(ev);
    return {
      altKey: ev.altKey,
      ctrlKey: ev.ctrlKey,
      shiftKey: ev.shiftKey,
      type: ev.type,
      key: JsKeyCode2Key(ev.keyCode),
      code: ev.keyCode,
    };
  }

  function CreateNewContext(node) {
    return {
      // InputContext
      contextID: '',
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

  function EnterContext(node) {
    var context = CreateNewContext(node);
    debug("EnterContext(" + node + ")");
    context.contextID = node.id;  // TODO(hungte) Replace by a real ID.
    self.context = context;
    return { contextID: context.contextID, type: context.type };
  }

  function LeaveContext() {
    debug("LeaveContextl()");
    // TODO(hungte) Really leave console when debug is finished.
    // self.context = null;
  }

  function Update() {
    var context = GetContext();
    var ui;

    // http://stackoverflow.com/questions/8039182/matching-jquery-text-to-nbsp
    var nbsp = '\xa0';

    // composition area
    ui = $('#imePanel #composition');
    ui.text((context ? context.composition.text : "" )+ nbsp);

    // candidates window
    ui = $('#imePanel #candidates');
    ui.empty().append(nbsp);
    if (context) {
      context.candidates.forEach(function (item) {
        var label = item.label || item.id;
        ui.append(
            $('<span/>', {text: item.candidate + ' ', "class": "candidate"}).
            prepend($('<span/>', {text: label, "class": "candidate_label"})));
      });
    }
    if (self.candidate_window.visible) {
      ui.show();
    } else {
      ui.hide();
    }

    // Update IME UI
    ui = $('#imePanel #menu');
    ui.empty();
    self.menuitems.forEach(function (item) {
      var label = item.label || item.id;
      ui.append(
          $('<li/>', {text: label}).click(function () {
            DispatchEvent('MenuItemActivated', self.engineID,
              self.menuitems[$(this).index()].id);
          }));
    });
  };

  function SetDefinedParams(dest, src) {
    var i;
    for (i = 2; i < arguments.length; i++) {
      var param_name = arguments[i];
      if (param_name in src)
        dest[param_name] = src[param_name];
    }
  };

  // public functions

  self.attach = function (node) {
    var keyEventHandler = function(ev) {
      var ev2 = ImeKeyEvent(ev);
      debug("<attach> " + ev.type + ": " + ev2);
      var result = DispatchEvent("KeyEvent", self.engineID, ev2);
      if (!result)
        ev.preventDefault();
      debug("result: " + result);
      Update();
      return result;
    };
    node.addEventListener('keydown', keyEventHandler);
    node.addEventListener('keyup', keyEventHandler);

    node.addEventListener('focus', function(ev) {
      var result = DispatchEvent("Focus", EnterContext(node));
      Update();
      return result;
    });
    node.addEventListener('blur', function(ev) {
      var context = GetContext();
      if (context == null)
        return;
      var result = DispatchEvent('Blur', GetContext().contextID);
      LeaveContext();
      return result;
    });
  };

  // chrome.input.ime API

  self.setComposition = function (parameters, callback) {
    debug('setComposition');
    var context = GetContext(parameters.contextID);
    SetDefinedParams(context.composition, parameters,
        'text', 'selectionStart', 'selectionEnd', 'cursor');
    Update();
  };

  self.clearComposition = function (parameters, callback) {
    debug('clearComposition');
    var context = GetContext(parameters.contextID);
    context.composition.text = '';
    context.composition.selectionStart = 0;
    context.composition.selectionEnd = 0;
    context.composition.cursor = 0;
    Update();
  };

  self.commitText = function (parameters, callback) {
    debug('commitText');
    var context = GetContext(parameters.contextID);
    var node = context.node;
    node.value = (node.value.substring(0, node.selectionStart) +
                  parameters.text +
                  node.value.substring(node.selectionEnd));
  };

  self.setCandidateWindowProperties = function (parameters, callback) {
    debug('setCandidateWindowProperties');
    SetDefinedParams(self.candidate_window, parameters.properties,
        'visible', 'cursorVisible', 'vertical', 'pageSize', 'auxiliaryText',
        'auxiliaryTextVisible', 'windowPosition');
    Update();
  };

  self.setCandidates = function (parameters, callback) {
    debug('setCandidates');
    var context = GetContext(parameters.contextID);
    context.candidates = parameters.candidates;
    Update();
  };

  self.setCursorPosition = function (parameters, callback) {
    throw "not implemented, sorry";
  };

  self.setMenuItems = function (parameters, callback) {
    debug('setMenuItems');
    self.menuitems = parameters.items;
    Update();
  };

  // Currently Chrome implements updateMenuItems in same way as setMenuItems.
  self.updateMenuItems = self.setMenuItems;

  self.deleteSurroundingText = function (parameters, callback) {
    throw "not implemented, sorry";
  };

  self.keyEventHandled = function (parameters, callback) {
    throw "not implemented, sorry";
  };

  var kEventPrefix = 'chrome.input.ime#';
  var kEarlyAbortEvents = ['KeyEvent'];  // Return true to abort.

  function CreateEventHandler(event_name) {
    var needEarlyAbort = (kEarlyAbortEvents.indexOf(event_name) >= 0);
    return { addListener: function (callback) {
      document.addEventListener(
          kEventPrefix + event_name,
          function (ime_ev) {
            debug('on' + event_name);
            var result = callback.apply(null, ime_ev.detail);
            if (needEarlyAbort && result) {
              ime_ev.preventDefault();
            }
            return result;
          }, false);
    } };
  }

  function DispatchEvent(type) {
    var params = Array.prototype.slice.call(arguments, 1);
    var imeEvent = new CustomEvent(kEventPrefix + type);
    imeEvent.initCustomEvent(imeEvent.type, false,
        (kEarlyAbortEvents.indexOf(type) >= 0), params);
    return document.dispatchEvent(imeEvent);
  }
  self.DispatchEvent = DispatchEvent;

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
}

// Testing functions
testContextID = 'input';

function test_setCandidateWindowProperties(flag) {
  chrome.input.ime.setCandidateWindowProperties({
    contextID: testContextID,
    properties: {visible: flag}});
}

function test_clearComposition() {
  chrome.input.ime.clearComposition({
    contextID: testContextID});
}

function test_setComposition(text) {
  chrome.input.ime.setComposition({
    contextID: testContextID,
    text: text});
}

function test_commitText(text) {
  chrome.input.ime.commitText({
    contextID: testContextID,
    text: text});
}

function test_setCandidates(candidate_string) {
  var i;
  var items = [];

  for (i in candidate_string) {
    items.push({
      candidate: candidate_string[i],
      id: parseInt(i),
      label: "" + (parseInt(i) + 1)});
  }
  chrome.input.ime.setCandidates({
    contextID: testContextID,
    candidates: items});
}

function test_setMenuItems(labels_array) {
  var i;
  var items = [];
  labels_array.forEach(function(label) {
    items.push({
      id: 'id_' + label,
      label: label,
      style: 'radio',
    });
  });
  chrome.input.ime.setMenuItems({
    engineID: chrome.input.ime.engineID,
    items: items});
}

// jquery-based test init
$(function() {
  chrome.input = {
    ime: new chrome_input_ime
  };

  // Install IME to test area
  var node = document.getElementById(testContextID);
  chrome.input.ime.attach(node);

  if (chrome && chrome.extension) {
    var croscin = chrome.extension.getBackgroundPage().croscin.instance;
    var jscin = chrome.extension.getBackgroundPage().jscin;

    // Duplicate log to this page. TODO(hungte) Allow jscin to chain error logs.
    if (!jscin.log_old) {
      jscin.log_old = jscin.log;
    }
    jscin.log = function (arg) { jscin.log_old(arg); console.log(arg); };

    croscin.ime_api = chrome.input.ime;
    croscin.ime_api = croscin.kImeApiType.emulation;
    croscin.registerEventHandlers();
    // croscin has already started, so we need to activate again.
    chrome.input.ime.DispatchEvent('Activate', 'input_ime');

    $('#TestItems').hide();
  } else {
    // Running in simple web page, let's enable all testing buttons.
    $('#TestItems button').attr("onClick",
        function () { return "test_" + $(this).text(); });
    chrome.input.ime.onKeyEvent.addListener(function(engineID, ev) {
      var val = $('#chkKeyEvent').prop('checked');
      debug("onKeyEvent(" + engineID + "): " + ev);
      return !val;
    });
    chrome.input.ime.onBlur.addListener(function(contextID) {
      debug("onBlur(" + contextID + ")");
    });
    chrome.input.ime.onFocus.addListener(function(context) {
      debug(context);
      debug("onFocus({" + context.contextID + ", " + context.type + "})");
    });
    chrome.input.ime.onMenuItemActivated.addListener(function(engineID, menu_id) {
      debug("menu item activated: id=" + menu_id);
    });
  }
  node.focus();
})
