/**
 * @fileoverview Description of this file.
 */

import { $, jQuery } from "../jquery/jquery.js";
import "../jquery/jquery-ui.js";

import { ChromeInputIME } from "../input_api/chrome_input_ime.js";
import { ChromeInputImeImplPage } from "../input_api/impl_page.js";

// Testing functions
var testContextID = '1';

function debug() {
  console.log.apply(console, arguments);
}

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

// jquery-based test init
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

$(function() {
  var ime_api = new ChromeInputIME;
  chrome.input = { ime: ime_api };
  var impl = new ChromeInputImeImplPage;

  chrome.input.ime.onUiMenu.addListener(function (engine) {
    var ui = $('#imePanel #menu');
    ui.empty();
    engine.menuitems.forEach(function (item) {
      var label = item.label || item.id;
      ui.append(
          $('<li/>', {text: label}).click(function () {
            ime_api.dispatchEvent(
                'MenuItemActivated', engine.engineID,
                engine.menuitems[$(this).index()].id);
          }));
    });
  });

  chrome.input.ime.onUiCandidateWindow.addListener(function (engine) {
    var ui = $('#imePanel #candidates');
    if (!engine.candidate_window.visible) {
      ui.hide();
    }
    ui.show();
  });

  chrome.input.ime.onUiCandidates.addListener(function (context) {
    var ui = $('#imePanel #candidates');
    var nbsp = '\xa0';
    ui.empty().append(nbsp);
    context.candidates.forEach(function (item) {
      var label = item.label || item.id;
      ui.append(
          $('<span/>', {text: item.candidate + ' ', "class": "candidate"}).
          click(function () {
            console.log("CandidateClicked", item);
            ime_api.dispatchEvent('CandidateClicked',
              ime_api.engineID, item.id, 'left'); }).
          prepend($('<span/>', {text: label, "class": "candidate_label"})));
    });
  });

  chrome.input.ime.onUiComposition.addListener(function (context) {
    // composition area
    var ui = $('#imePanel #composition');
    // http://stackoverflow.com/questions/8039182/matching-jquery-text-to-nbsp
    var nbsp = '\xa0';
    ui.text((context ? context.composition.text : "" )+ nbsp);
  });

  var node = document.getElementById('input');
  node.blur();
  impl.init();
  impl.attach(node);

  if (chrome && chrome.extension) {
    var croscin = chrome.extension.getBackgroundPage().croscin.instance;
    var jscin = chrome.extension.getBackgroundPage().jscin;

    // Get all logs on my console.
    jscin.add_logger(console.log, console);
    croscin.set_ime_api(chrome.input.ime, 'emulation');
    croscin.registerEventHandlers();
    // croscin has already started, so we need to activate again.
    chrome.input.ime.dispatchEvent('Activate', 'input_ime');
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
});
