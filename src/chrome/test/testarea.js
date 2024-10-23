/**
 * @fileoverview Description of this file.
 */

import { $, jQuery } from "../jquery/jquery-ui.js";
import { ChromeInputIME } from "../emulation/chrome_input_ime.js";
import { ChromeInputImeImplPage } from "../emulation/impl_page.js";

// Testing functions
const testContextID = '1';

function debug(...args) {
  console.log("[testarea]", ...args);
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
  let i;
  let items = [];

  for (i in candidate_string) {
    items.push({
      candidate: candidate_string[i],
      id: parseInt(i),
      label: `${parseInt(i) + 1}`});
  }
  chrome.input.ime.setCandidates({
    contextID: testContextID,
    candidates: items});
}

// jquery-based test init
function test_setMenuItems(labels_array) {
  let i;
  let items = [];
  for (let label of labels_array) {
    items.push({
      id: 'id_' + label,
      label: label,
      style: 'radio',
    });
  }
  chrome.input.ime.setMenuItems({
    engineID: chrome.input.ime.engineID,
    items: items});
}

$(function() {
  let ime_api = new ChromeInputIME();
  chrome.input = { ime: ime_api };
  let impl = new ChromeInputImeImplPage(ime_api);

  chrome.input.ime.onUiMenu.addListener(function (engine) {
    let ui = $('#imePanel #menu');
    ui.empty();
    for (let item of engine.menuitems) {
      let label = item.label || item.id;
      ui.append(
          $('<li/>', {text: label}).click(function () {
            ime_api.dispatchEvent(
                'MenuItemActivated', engine.engineID,
                engine.menuitems[$(this).index()].id);
          }));
    }
  });

  chrome.input.ime.onUiCandidateWindow.addListener(function (engine) {
    let cui = $('#imePanel #candidates');
    cui.toggle(engine.candidate_window.visible);
    let aui = $('#imePanel #auxiliary');
    aui.empty().append(engine.candidate_window.auxiliaryText);
    aui.toggle(engine.candidate_window.auxiliaryTextVisible);
  });

  chrome.input.ime.onUiCandidates.addListener(function (context) {
    let ui = $('#imePanel #candidates');
    let nbsp = '\xa0';
    ui.empty().append(nbsp);
    for (let item of context.candidates) {
      let label = item.label || item.id;
      ui.append(
          $('<span/>', {text: item.candidate + ' ', "class": "candidate"}).
          click(function () {
            console.log("CandidateClicked", item);
            ime_api.dispatchEvent('CandidateClicked',
              ime_api.engineID, item.id, 'left'); }).
          prepend($('<span/>', {text: label, "class": "candidate_label"})));
    }
  });

  chrome.input.ime.onUiComposition.addListener(function (context) {
    // composition area
    let ui = $('#imePanel #composition');
    // http://stackoverflow.com/questions/8039182/matching-jquery-text-to-nbsp
    let nbsp = '\xa0';
    ui.text((context ? context.composition.text : "" )+ nbsp);
  });

  let node = document.getElementById('input');
  node.blur();
  impl.init();
  impl.attach(node);

  if (chrome && chrome.extension) {
    let croscin = chrome.extension.getBackgroundPage().croscin.instance;
    let jscin = chrome.extension.getBackgroundPage().jscin;

    // Get all logs on my console.
    for (let l in jscin.loggers) {
      jscin.loggers[l].enable(true).addConsole(console);
    }

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
      let val = $('#chkKeyEvent').prop('checked');
      debug("onKeyEvent:", ev, engineID);
      return !val;
    });
    chrome.input.ime.onBlur.addListener(function(contextID) {
      debug("onBlur:", contextID);
    });
    chrome.input.ime.onFocus.addListener(function(context) {
      debug(context);
      debug("onFocus:", context.contextID, context.type);
    });
    chrome.input.ime.onMenuItemActivated.addListener(function(engineID, menu_id) {
      debug("menu item activated: id=", menu_id);
    });
  }

  node.focus();
});
