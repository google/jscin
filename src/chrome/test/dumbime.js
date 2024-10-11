// Copyright 2011 Google Inc. All Rights Reserved.

/**
 * @fileoverview Description of this file.
 * @author kcwu@google.com (Kuang-che Wu)
 */

import { CreateImeKeyEvent } from "../input_api/ime_event.js";

var croscin = chrome.extension.getBackgroundPage().croscin.instance;
var jscin = chrome.extension.getBackgroundPage().jscin;
var log = function(...args) { console.log(...args); };

var DumbIME = function() {
  var self = this;
  var dummy_function = function() {};
  var _listeners = {};

  function create_listener(name) {
    _listeners[name] = [];
    return {
      addListener: function(arg) {
          _listeners[name].push(arg); },
      invoke: function(...args) {
        for (let callback of _listeners[name]) {
          callback(...args);
        }
      },
    };
  }

  return {
    // internal helpers
    _listeners: _listeners,

    // chrome.input.api.*

    commitText: function (arg) {
      log('commitText', arguments);
      document.getElementById('committed').value += arg.text;
    },
    setCandidateWindowProperties: function () {
      log('setCandidateWindowProperties', arguments);
    },
    setComposition: function (arg) {
      log('setComposition', arguments);
      document.getElementById('composition').value = arg.text;
    },
    clearComposition: function () {
      log('clearComposition', arguments);
      document.getElementById('composition').value = '';
    },
    setCandidates: function (arg) {
      log('setCandidates', arguments);
      var s = '';
      for (var i in arg.candidates) {
        var cand = arg.candidates[i];
        s += cand.label + ' ' + cand.candidate + ', ';
      }
      document.getElementById('candidates').value = s;
    },
    updateMenuItems: function () {
      log('updateMenuItems', arguments);
    },
    setMenuItems: function () {
      log('setMenuItems', arguments);
    },
    onActivate: create_listener('onActivate'),
    onDeactivated: create_listener('onDeactivated'),
    onFocus: create_listener('onFocus'),
    onBlur: create_listener('onBlur'),
    onKeyEvent: create_listener('onKeyEvent'),
    onInputContextUpdate: create_listener('onInputContextUpdate'),
    onReset: create_listener('onReset'),
    onCandidateClicked: create_listener('onCandidateClicked'),
    onMenuItemActivated: create_listener('onMenuItemActivated')
  };
};

function init() {
  var engineID = croscin.kEngineId;
  var dumb_ime = new DumbIME;

  // duplicate log to this page
  jscin.add_logger(console.log, console);

  // Hook IME API.
  croscin.set_ime_api(dumb_ime, 'dumb');
  croscin.registerEventHandlers();

  // key events
  document.getElementById('input').onkeydown = function (evt) {
    var e = CreateImeKeyEvent(evt);
    log('onkeydown');
    log(evt, e);
    dumb_ime.onKeyEvent.invoke(engineID, e);
    return false;
  }
  document.getElementById('input').onkeyup = function (evt) {
    var e = CreateImeKeyEvent(evt);
    log('onkeyup');
    log(evt, e);
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
