// Copyright 2011 Google Inc. All Rights Reserved.

/**
 * @fileoverview Description of this file.
 * @author kcwu@google.com (Kuang-che Wu)
 */

var croscin = chrome.extension.getBackgroundPage().croscin.instance;
var jscin = chrome.extension.getBackgroundPage().jscin;
var current_context = {};

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
  var dumb_ime = croscin.dumb_ime;

  // duplicate log to this page
  if (!jscin.log_old) {
    jscin.log_old = jscin.log;
  }
  jscin.log = function (arg) { jscin.log_old(arg); console.log(arg); };

  // key events
  document.getElementById('input').onkeydown = function (evt) {
    console.log('onkeydown');
    console.log(evt);
    var e = translateKeyEvent(evt);
    dumb_ime.listener.onKeyEvent[0](engineID, e);
    return false;
  }
  document.getElementById('input').onkeyup = function (evt) {
    console.log('onkeyup');
    console.log(evt);
    var e = translateKeyEvent(evt);
    dumb_ime.listener.onKeyEvent[0](engineID, e);
    return false;
  }

  // Generate events
  document.getElementById('onActivate').onclick = function () {
    dumb_ime.listener.onActivate[0](engineID);
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
    dumb_ime.listener.onFocus[0](context);
  }

  // Hook IME APIs
  var ime_api = croscin.ime_api;
  ime_api.commitText = function (arg) {
    //console.log('commitText');
    //console.log(arg);
    document.getElementById('committed').value += arg.text;
  }
  ime_api.setCandidateWindowProperties = function (arg) {
    console.log('setCandidateWindowProperties');
    console.log(arg);
  }
  ime_api.setComposition = function (arg) {
    console.log('setComposition');
    console.log(arg);
    document.getElementById('composition').value = arg.text;
  }
  ime_api.clearComposition = function (arg) {
    console.log('clearComposition');
    console.log(arg);
    document.getElementById('composition').value = '';
  }
  ime_api.setCandidates = function (arg) {
    console.log('setCandidates');
    console.log(arg);
    var s = '';
    for (var i in arg.candidates) {
      var cand = arg.candidates[i];
      s += cand.label + ' ' + cand.candidate + ', ';
    }
    document.getElementById('candidates').value = s;
  }
  ime_api.updateMenuItems = function (arg) {
    console.log('updateMenuItems');
    console.log(arg);
  }
  ime_api.setMenuItems = function (arg) {
    console.log('setMenuItems');
    console.log(arg);
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
