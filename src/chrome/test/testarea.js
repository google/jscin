/**
 * @fileoverview Test Area. A playground for input.ime implementation.
 *
 * The Test Area uses the pure software implementation
 * (ime_api/chrome.input.ime.js) and the webpage provider,
 * with a hard-coded UI (so we don't need to worry about creating the imePanel
 * on our own with injecting code into the web pages) to verify the croscin &
 * jscin behavior.
 */

import { $ } from "../jquery/jquery-ui.js";
import { WebPageIme } from "../ime_api/webpage.js";
import { CrOS_CIN, jscin } from "../croscin.js";

function debug(...args) {
  console.log("[testarea]", ...args);
}

// Testing functions
const testContextID = '0';
const contextID = testContextID;

class testInputIme {
  constructor(ime) {
    this.ime = ime;
  }

  items() {
    return [
      () => { this.test_setCandidateWindowProperties({vertical:false}); },
      () => { this.test_setCandidateWindowProperties({vertical:true}); },
      () => { this.test_setCandidateWindowProperties({visible:false}); },
      () => { this.test_setCandidateWindowProperties({visible:true}); },
      () => { this.test_setComposition("hello"); },
      () => { this.test_clearComposition(); },
      () => { this.test_commitText("hello world"); },
      () => { this.test_setCandidates("abcdefghi"); },
      () => { this.test_setCandidates("ab"); },
      () => { this.test_setCandidates(""); },
      () => { this.test_setMenuItems(["Item 1", "Item 2", "Blah"]); },
      () => { this.test_setMenuItems(["Activated"]); },
      () => { this.test_setMenuItems([]); },
    ];
  }

  bind() {
    let btns = $('button');
    let items = this.items();
    console.assert(btns.length == items.length);
    btns.each((i, e) => {
      debug("i,e=", i, e);
      const t = items[i];
      $(e).text(t.toString().match(/{ this\.test_(.*); }/)[1]);
      $(e).click(t);
    });
    this.ime.onKeyEvent.addListener(function(engineID, ev) {
      let val = $('#chkKeyEvent').prop('checked');
      debug("onKeyEvent:", ev, engineID);
      return !val;
    });
    this.ime.onBlur.addListener(function(contextID) {
      debug("onBlur:", contextID);
      $('#imePanel').addClass('hidden');
    });
    this.ime.onFocus.addListener(function(context) {
      debug("onFocus:", context.contextID, context.type);
      $('#imePanel').removeClass('hidden');
    });
    this.ime.onMenuItemActivated.addListener(function(engineID, menu_id) {
      debug("menu item activated: id=", menu_id);
    });
  }

  test_setCandidateWindowProperties(properties) {
    this.ime.setCandidateWindowProperties({contextID, properties});
  }

  test_clearComposition() {
    this.ime.clearComposition({contextID});
  }

  test_setComposition(text) {
    this.ime.setComposition({contextID, text});
  }

  test_commitText(text) {
    $('#input').focus();
    this.ime.commitText({contextID, text});
  }

  test_setCandidates(candidate_string) {
    let candidates = [];
    [...candidate_string].forEach((candidate, id) => {
      const label = `${id + 1}`;
      candidates.push({candidate, id, label});
    });
    this.ime.setCandidates({contextID, candidates});
  }

  test_setMenuItems(labels_array) {
    let items = [];
    const style = 'radio';
    for (let label of labels_array) {
      const id = `id_${label}`;
      items.push({id, label, style});
    }
    const engineID = this.ime.engineID;
    this.ime.setMenuItems({engineID, items});
  }
}

async function Init() {
  // Show all logs.
  jscin.logger.enableAllLoggers();

  let ime = new WebPageIme('TestAreaPanel', true);
  let croscin = new CrOS_CIN(ime);
  globalThis.croscin = croscin;

  await croscin.Initialize();

  const node = $('#input');
  ime.onActivate.dispatch(ime.engineID);
  ime.attach(node[0]);

  let test = new testInputIme(ime);
  $('#TestItems').hide();
  $('#ShowTestItems').click(() => $('#TestItems').toggle());
  test.bind();
  node.focus();
}

console.log(
  "Welcome to testarea! To debug, you can explore:\n",
  "- croscin [.jscin, .ime_api, ...]\n\n");
Init();
