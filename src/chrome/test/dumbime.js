// Copyright 2011 Google Inc. All Rights Reserved.

/**
 * @fileoverview Description of this file.
 * @author kcwu@google.com (Kuang-che Wu)
 */

let page = chrome.extension.getBackgroundPage();
var croscin = page.croscin.instance;
var jscin = page.jscin;

function log(...args) {
  console.log(...args);
}

function DumbIME() {
  let dummy_function = function() {};
  let _listeners = {};

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
    setCandidateWindowProperties: function (arg) {
      log('setCandidateWindowProperties', arguments);
      if ('visible' in arg.properties) {
        let color = 'black';
        if (!arg.properties.visible)
          color = 'lightgray';
        document.getElementById('candidates').style.color = color;
      }
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
      let s = '';
      for (let i in arg.candidates) {
        let cand = arg.candidates[i];
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
  let engineID = croscin.kEngineId;
  let dumb_ime = new DumbIME();

  // duplicate log to this page
  jscin.add_logger(console.log, console);

  // Hook IME API.
  croscin.set_ime_api(dumb_ime, 'dumb');
  croscin.registerEventHandlers();

  // key events
  document.getElementById('input').onkeydown = function (evt) {
    log('onkeydown');
    log(evt);
    dumb_ime.onKeyEvent.invoke(engineID, evt);
    return false;
  }
  document.getElementById('input').onkeyup = function (evt) {
    let e = CreateImeKeyEvent(evt);
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
    let context = {
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
