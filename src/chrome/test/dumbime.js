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

function ByID(id) {
  return document.getElementById(id);
}

function DumbIME() {
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
      ByID('committed').value += arg.text;
    },
    setCandidateWindowProperties: function (arg) {
      log('setCandidateWindowProperties', arguments);
      if ('visible' in arg.properties) {
        let color = 'black';
        if (!arg.properties.visible)
          color = 'lightgray';
        ByID('candidates').style.color = color;
      }
    },
    setComposition: function (arg) {
      log('setComposition', arguments);
      ByID('composition').value = arg.text;
    },
    clearComposition: function () {
      log('clearComposition', arguments);
      ByID('composition').value = '';
    },
    setCandidates: function (arg) {
      log('setCandidates', arguments);
      let s = '';
      for (let cand of arg.candidates) {
        s += cand.label + ' ' + cand.candidate + ', ';
      }
      ByID('candidates').value = s;
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
  ByID('input').onkeydown = function (evt) {
    log('onkeydown', evt);
    dumb_ime.onKeyEvent.invoke(engineID, evt);
    return false;
  }
  ByID('input').onkeyup = function (evt) {
    log('onkeyup', evt);
    dumb_ime.onKeyEvent.invoke(engineID, evt);
    return false;
  }

  // Generate events
  ByID('onActivate').onclick = function () {
    dumb_ime.onActivate.invoke(engineID);
    ByID('input').title = 'Please click onFocus to start';
    ByID('onActivate').disabled = true;
    ByID('onFocus').disabled = false;
  }
  ByID('onFocus').onclick = function () {
    let context = {
      'contextID': 1,
    };
    ByID('input').title = 'Please start to input';
    ByID('input').disabled = false;
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
