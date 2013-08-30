// Copyright 2011 Google Inc. All Rights Reserved.

/**
 * @fileoverview Description of this file.
 * @author kcwu@google.com (Kuang-che Wu)
 */

var croscin = chrome.extension.getBackgroundPage().croscin.instance;
var jscin = chrome.extension.getBackgroundPage().jscin;

DumbIME = function() {
  var self = this;
  var dummy_function = function() {};
  var _listeners = {};

  function create_listener(name) {
    _listeners[name] = [];
    return {
      addListener: function(arg) {
          _listeners[name].push(arg); },
      invoke: function() {
          var args = arguments;
          _listeners[name].forEach(function (callback) {
            callback.apply(this, args);
          }); } };
  }

  return {
    // internal helpers
    _listeners: _listeners,

    // chrome.input.api.*

    commitText: function (arg) {
      console.log('commitText');
      console.log(arguments);
      document.getElementById('committed').value += arg.text;
    },
    setCandidateWindowProperties: function () {
      console.log('setCandidateWindowProperties');
      console.log(arguments);
    },
    setComposition: function (arg) {
      console.log('setComposition');
      console.log(arguments);
      document.getElementById('composition').value = arg.text;
    },
    clearComposition: function () {
      console.log('clearComposition');
      console.log(arguments);
      document.getElementById('composition').value = '';
    },
    setCandidates: function (arg) {
      console.log('setCandidates');
      console.log(arguments);
      var s = '';
      for (var i in arg.candidates) {
        var cand = arg.candidates[i];
        s += cand.label + ' ' + cand.candidate + ', ';
      }
      document.getElementById('candidates').value = s;
    },
    updateMenuItems: function () {
      console.log('updateMenuItems');
      console.log(arguments);
    },
    setMenuItems: function () {
      console.log('setMenuItems');
      console.log(arguments);
    },
    onActivate: create_listener('onActivate'),
    onDeactivated: create_listener('onDeactivated'),
    onFocus: create_listener('onFocus'),
    onBlur: create_listener('onBlur'),
    onKeyEvent: create_listener('onKeyEvent'),
    onInputContextUpdate: create_listener('onInputContextUpdate'),
    onCandidateClicked: create_listener('onCandidateClicked'),
    onMenuItemActivated: create_listener('onMenuItemActivated')
  };
};

// TODO(hungte) Move key translation to somewhere shared by everyone.
function translateKeyEvent(evt) {
  var e = {
    'altKey': evt.altKey,
    'ctrlKey': evt.ctrlKey,
    'shiftKey': evt.shiftKey,
    'type': evt.type,
    'key': String.fromCharCode(evt.keyCode),
    // keyCode, charCode
  };
  switch (evt.keyCode) {
    case 8:
      e.key = 'Backspace';
      break;
    case 27:
      e.key = 'Esc';
      break;
  }
  // TODO(kcwu) recgonize more keys
  if (evt.keyIdentifier in ['Left', 'Right', 'Up', 'Down']) {
    e.key = evt.keyIdentifier;
  }
  return e;
}

function init() {
  var engineID = croscin.kEngineId;
  var dumb_ime = new DumbIME;

  // duplicate log to this page
  if (!jscin.log_old) {
    jscin.log_old = jscin.log;
  }
  jscin.log = function () {
    jscin.log_old.apply(jscin, arguments);
    console.log.apply(console, arguments); };

  // Hook IME API.
  croscin.set_ime_api(dumb_ime, 'dumb');
  croscin.registerEventHandlers();

  // key events
  document.getElementById('input').onkeydown = function (evt) {
    var e = translateKeyEvent(evt);
    console.log('onkeydown');
    console.log(evt, e);
    dumb_ime.onKeyEvent.invoke(engineID, e);
    return false;
  }
  document.getElementById('input').onkeyup = function (evt) {
    var e = translateKeyEvent(evt);
    console.log('onkeyup');
    console.log(evt, e);
    dumb_ime.onKeyEvent.invoke(engineID, e);
    return false;
  }

  // Generate events
  document.getElementById('onActivate').onclick = function () {
    dumb_ime.onActivate.invoke(engineID);
    document.getElementById('input').title = 'Please click onFocus to start';
    document.getElementById('onActivate').disabled = true;
    document.getElementById('onFocus').disabled = false;
  }
  document.getElementById('onFocus').onclick = function () {
    var context = {
      'contextID': 1,
    };
    document.getElementById('input').title = 'Please start to input';
    document.getElementById('input').disabled = false;
    dumb_ime.onFocus.invoke(context);
  }
}

// Browser loader entry
document.addEventListener(
    'readystatechange',
    function() {
      if (document.readyState === 'complete') {
        init();
      }
    }
)
