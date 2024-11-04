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

function debug(...args) {
  console.log("[testarea]", ...args);
}

// Testing functions
const testContextID = '0';

class testInputIme {
  constructor(ime) {
    this.ime = ime;
  }

  items() {
    return [
      (ev) => { this.test_setCandidateWindowProperties(true); },
      (ev) => { this.test_setCandidateWindowProperties(false); },
      (ev) => { this.test_setComposition("hello"); },
      (ev) => { this.test_clearComposition(); },
      (ev) => { this.test_commitText("hello world"); },
      (ev) => { this.test_setCandidates("abcdefghi"); },
      (ev) => { this.test_setCandidates("ab"); },
      (ev) => { this.test_setCandidates(""); },
      (ev) => { this.test_setMenuItems(["Item 1", "Item 2", "Blah"]); },
      (ev) => { this.test_setMenuItems(["Activated"]); },
      (ev) => { this.test_setMenuItems([]); },
    ];
  }

  bind() {
    let btns = document.getElementsByTagName('button');
    let items = this.items();
    console.assert(btns.length == items.length);
    for (let i = 0; i < btns.length; i++) {
      $(btns[i]).text(`${items[i]}`.match(/{ this\.test_(.*); }/)[1]);
      $(btns[i]).click(items[i]);
    }
    this.ime.onKeyEvent.addListener(function(engineID, ev) {
      let val = $('#chkKeyEvent').prop('checked');
      debug("onKeyEvent:", ev, engineID);
      return !val;
    });
    this.ime.onBlur.addListener(function(contextID) {
      debug("onBlur:", contextID);
    });
    this.ime.onFocus.addListener(function(context) {
      debug("onFocus:", context.contextID, context.type);
    });
    this.ime.onMenuItemActivated.addListener(function(engineID, menu_id) {
      debug("menu item activated: id=", menu_id);
    });
  }

  test_setCandidateWindowProperties(flag) {
    this.ime.setCandidateWindowProperties({
      contextID: testContextID,
      properties: {visible: flag}});
  }

  test_clearComposition() {
    this.ime.clearComposition({
      contextID: testContextID});
  }

  test_setComposition(text) {
    this.ime.setComposition({
      contextID: testContextID,
      text: text});
  }

  test_commitText(text) {
    let node = document.getElementById('input');
    node.focus();
    this.ime.commitText({
      contextID: testContextID,
      text: text});
  }

  test_setCandidates(candidate_string) {
    let i;
    let items = [];

    for (i in candidate_string) {
      items.push({
        candidate: candidate_string[i],
        id: parseInt(i),
        label: `${parseInt(i) + 1}`});
    }
    this.ime.setCandidates({
      contextID: testContextID,
      candidates: items});
  }

  // jquery-based test init
  test_setMenuItems(labels_array) {
    let i;
    let items = [];
    for (let label of labels_array) {
      items.push({
        id: 'id_' + label,
        label: label,
        style: 'radio',
      });
    }
    this.ime.setMenuItems({
      engineID: this.ime.engineID,
      items: items});
  }
}

async function Init() {
  // Show all logs.
  let jscin = croscin.jscin;
  jscin.loggers.jscin.enableAllLoggers();

  let ime = new WebPageIme();
  croscin.instance = new croscin.IME(ime);
  await croscin.instance.Initialize();

  let node = document.getElementById('input');
  ime.onActivate.dispatch(ime.engineID);
  ime.attach(node);

  let test = new testInputIme(ime);
  test.bind();
  node.focus();
}

globalThis.croscin = croscin;
console.log(
  "Welcome to testarea! To debug, you can explore:\n",
  "- croscin [.jscin, .instance [.ime_api]]\n\n");
Init();
