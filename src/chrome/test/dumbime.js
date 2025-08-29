// Copyright 2011 Google Inc. All Rights Reserved.

/**
 * @fileoverview An even simpler IME test page
 * @author kcwu@google.com (Kuang-che Wu)
 *
 * The `dumbime` does not use the standard emulation (chrome.input.ime)
 * and its derived classes; instead the DumbIME has its own simple
 * implementation so we can check if the croscin behavior is the same across IME
 * API providers, also to debug without the webpage implementation.
 */

import { CrOS_CIN, jscin } from "../croscin.js";

function log(...args) {
  console.log("[dumbime]", ...args);
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

async function init() {
  // betted Debugging
  jscin.logger.enableAllLoggers();

  let dumb_ime = new DumbIME();
  let croscin = new CrOS_CIN(dumb_ime);
  const engineID = croscin.kEngineId;
  globalThis.croscin = croscin;

  await croscin.Initialize();

  // key events
  document.getElementById('input').onkeydown = function (evt) {
    log('onkeydown', evt);
    dumb_ime.onKeyEvent.invoke(engineID, evt);
    return false;
  }
  document.getElementById('input').onkeyup = function (evt) {
    log('onkeyup', evt);
    dumb_ime.onKeyEvent.invoke(engineID, evt);
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
