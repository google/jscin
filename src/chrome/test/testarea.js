/**
 * @fileoverview Test Area. A playground for input.ime implementation.
 *
 * The Test Area uses the pure software implementation
 * (emulation/chrome.input.ime.js) and the webpage provider,
 * with a hard-coded UI (so we don't need to worry about creating the imePanel
 * on our own with injecting code into the web pages) to verify the croscin &
 * jscin behavior.
 */

import { $, jQuery } from "../jquery/jquery-ui.js";
import { WebPageIme } from "../emulation/webpage.js";
import { croscin } from "../croscin.js";

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

async function Init() {
  // Show all logs.
  let jscin = croscin.jscin;
  jscin.loggers.jscin.enableAllLoggers();

  let ime = new WebPageIme();
  croscin.instance = new croscin.IME(ime);
  await croscin.instance.Initialize();

  let node = document.getElementById('input');
  ime.attach(node);
  ime.dispatch("Activate", ime.engineID);

  $('#TestItems').hide();

  if (false) {
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
}

globalThis.croscin = croscin;
Init();
