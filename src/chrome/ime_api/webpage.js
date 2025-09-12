// Copyright 2024 Google Inc. All Rights Reserved.

/**
 * @fileoverview A Chrome browser web page provider for chrome.input.ime.
 * @author hungte@google.com (Hung-Te Lin)
 */

import { AddLogger, Logged } from "../jscin/logger.js";
const {debug, warn, error, assert, trace} = AddLogger("ime.webpage");
Logged(debug, warn, error, assert, trace);

import { $ } from "../jquery/jquery.js";
import { ChromeInputIme } from "./chrome_input_ime.js";

// http://stackoverflow.com/questions/8039182/matching-jquery-text-to-nbsp
const NBSP = '\xa0';
const _ = globalThis.chrome?.i18n?.getMessage || ((m)=>m);

export class WebPageIme extends ChromeInputIme {

  constructor(panel='imePanel', on_the_spot=false) {
    super();
    this.engineID = "jscin.chrome.input.ime.webpage";
    this.panel = panel;
    this.contexts = [];
    this.vertical = true;
    this.composition = undefined;

    this.idAuxiliary = 'auxiliary';
    this.idCandidates = 'candidates';
    this.idComposition = 'composition';
    this.idMenu = 'menu';
    this.on_the_spot = on_the_spot;

    if (this.on_the_spot)
      $(`#${this.idComposition}`).hide();
  }

  createPanel() {
    return $('<div/>', {id: this.panel}).append(
      $('<div/>', {id: this.idComposition})).appand(
      $('<div/>', {id: this.idCandidates})).appand(
      $('<div/>', {id: this.idAuxiliary}));
  }

  getNode(id) {
    const suffix = id ? ` #${id}` : '';
    const node = $(`#${this.panel}${suffix}`);
    assert(node, "Failed to find IME panel node by id:", id);
    return node;
  }
  getCommitNode(parameters) {
    if (parameters)
      return this.contexts[parameters.contextID];
    return document.activeElemnt;
  }
  getAuxiliaryNode() {
    return this.getNode(this.idAuxiliary);
  }
  getCandidatesNode() {
    return this.getNode(this.idCandidates);
  }
  getCompositionNode(parameters) {
    if (this.on_the_spot) {
      return this.getCommitNode(parameters);
    } else {
      return this.getNode(this.idComposition);
    }
  }
  getMenuNode() {
    return this.getNode(this.idMenu);
  }
  getPanel() {
    return this.getNode();
  }

  getContextID(node) {
    return this.contexts.indexOf(node);
  }

  attach(node) {
    if (this.contexts.includes(node)) {
      assert(false, "Node already attached", node);
      return;
    }

    this.contexts.push(node);
    assert(node, "Attach needs a valid target DOM node.");
    /* for keydown and keyup, capture=true so we can do preventDefault. */
    node.addEventListener('keydown', this.domKeyDown.bind(this), true);
    node.addEventListener('keyup', this.domKeyUp.bind(this), true);
    node.addEventListener('focus', this.domFocus.bind(this));
    node.addEventListener('blur', this.domBlur.bind(this));
  }

  // DOM event listeners that can be overridden.

  domKeyDown(evt) {
    const r = this.onKeyEvent.dispatch(this.engineID, evt);
    debug("DOM keydown:", evt.code, evt, r, r ? "preventDefault" : "doDefault");

    if (r) {
      evt.preventDefault();
    } else {
      if (this.composition)
        this.onReset.dispatch(this.engineID);
    }
    return !r;
  }
  domKeyUp(evt) {
    debug("DOM keyup:", evt);
    this.onKeyEvent.dispatch(this.engineID, evt);
  }
  domFocus(evt) {
    debug("DOM focus:", evt.target, evt);
    const contextID = this.getContextID(evt.target);
    return this.onFocus.dispatch({contextID});
  }
  domBlur(evt) {
    debug("DOM blur:", evt.target, evt);
    if (this.composition)
      this.onReset.dispatch(this.engineID);
    return this.onBlur.dispatch(this.getContextID(evt.target));
  }

  // Helper functions
  notifyInsertText(node, data) {
    if (!InputEvent)
      return false;
    const inputType = 'insertText';
    const ev = new InputEvent("input", {data, inputType});
    node.dispatchEvent(ev);
  }

  insertNodeValue(node, text, select=true) {
    const value = node.value;
    const start = node.selectionStart;
    const end = node.selectionEnd;

    node.value = value.slice(0, start) + text + value.slice(end);
    const new_end = start + text.length;
    node.setSelectionRange(select ? start : new_end, new_end);
    if (text)
      this.notifyInsertText(node, text);
  }

  getNodeSelectedValue(node) {
    return node.value.slice(node.selectionStart, node.selectionEnd);
  }

  toggleCandidateWindow(show) {
    this.getPanel().toggleClass('hidden', !show);
  }

  // chrome.input.ime APIs

  async commitText(parameters) {
    /*
     * The browsers no longer support changing input contents using TextEvent,
     * so we have to manually set the value and then fire the IntputEvent.
     */
    const text = parameters.text;
    const node = this.contexts[parameters.contextID];  /* or, document.activeElemnt */
    this.insertNodeValue(node, text, false);
    return true;
  }

  // TODO(hungte) Bind CandidateClicked.
  async setCandidates(parameters) {
    const node = this.getCandidatesNode();
    node.empty();
    for (const c of parameters.candidates) {
      // Array30 %quick will send ch=null. Use u3000 for full width  height.
      const ch = c.candidate || c.annotation || '\u3000';
      let label = c.label || c.id;
      const candidate = `${ch} `;
      if (label == ' ')
        label = NBSP;
      if (!c.candidate && c.annotation) {
        // Special workaround for CrOS showing background=textcolor in
        // horizontal mode.
        label = '';
      }
      if (this.vertical && label)
        label += NBSP;
      node.append($('<span/>', {text: candidate, class: "candidate"}).
        prepend($('<span/>', {text: label, class: "candidate_label"})));
      if (this.vertical)
        node.append($('<br/>'));
    }
    if (node.is(':empty'))
      node.append(NBSP);
    return true;
  }

  async setCandidateWindowProperties(parameters) {
    const p = parameters.properties;
    function on_demand(name, callback) {
      if (name in p)
        callback(p[name]);
    }

    on_demand('vertical', (v) => {
      this.vertical = v;
    });
    on_demand('auxiliaryText', (v) => {
      const node = this.getAuxiliaryNode();
      const hint = this.vertical ? '' : _("imeToggleHint");
      node.text(`${NBSP}${v}${NBSP}`);
      if (hint)
        node.prepend($('<span/>').css({color: '#444'}).
          text(`${NBSP}${hint}|`));
    });
    on_demand('auxiliaryTextVisible', (v) => {
      this.getAuxiliaryNode().toggle(v);
    });
    on_demand('visible', (v) => {
      this.toggleCandidateWindow(v);
    });
    return true;
  }

  async clearComposition(parameters) {
    debug("clearComposition", parameters);
    const node = this.getCompositionNode(parameters);
    if (this.on_the_spot) {
      const selected = this.getNodeSelectedValue(node);
      if (selected == this.composition) {
        this.insertNodeValue(node, '');
      } else {
        debug("clearComposition: (no change because selection is not previous composition) ->", selected, this.composition);
      }
    } else {
      node.empty().append(NBSP);
    }
    this.composition = undefined;
    return true;
  };

  async setCompositionOnThSpot(text, node, p) {
    debug("setCompositionOnThSpot:", text, node.value, p);
    this.insertNodeValue(node, text);
    return true;
  }

  async setCompositionOverTheSpot(text, node, p) {
    debug("setCompositionOverTheSpot:", text, p);
    $(node).text(`${text}${NBSP}`)
    return true;
  }

  async setComposition(parameters) {
    const text = parameters.text || '';
    this.composition = text;
    const node = this.getCompositionNode(parameters);
    if (this.on_the_spot)
      return this.setCompositionOnThSpot(text, node, parameters);
    else
      return this.setCompositionOverTheSpot(text, node, parameters);
  }

  async setMenuItems(parameters) {
    const node = this.getNode('menu');
    node.empty();
    for (const i of parameters.items) {
      const label = i.label || i.id;
      const prefix = i.checked ? '>' : `${NBSP}`;
      const text = `${prefix}${NBSP}${label}`;
      const className = i.checked ? "active" : "";
      if (!i.id.startsWith('ime:'))
        node.append($('<hr/>'));
      node.append(
        $('<div/>', {text, class: className}).click(() => {
          this.onMenuItemActivated.dispatch(this.engineID, i.id);
        }));
    }
    return false;
  }

  async updateMenuItems(parameters) {
    return this.setMenuItems(parameters);
  }
}
