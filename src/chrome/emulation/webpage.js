// Copyright 2024 Google Inc. All Rights Reserved.

/**
 * @fileoverview A Chrome browser web page provider for chrome.input.ime.
 * @author hungte@google.com (Hung-Te Lin)
 */

import { AddLogger } from "../jscin/logger.js";
const {log, debug, info, warn, error, assert, trace} = AddLogger("ime.webpage");

import { $, jQuery } from "../jquery/jquery-ui.js";
import { ChromeInputIme } from "./chrome_input_ime.js";

// http://stackoverflow.com/questions/8039182/matching-jquery-text-to-nbsp
const NBSP = '\xa0';
const _ = globalThis.chrome?.i18n?.getMessage || ((m)=>m);

export class WebPageIme extends ChromeInputIme {

  constructor(panel='imePanel') {
    super();
    this.engineID = "jscin.chrome.input.ime.webpage";
    this.panel = panel;
    this.contexts = [];
  }

  // chrome.input.ime API

  getNode(id) {
    let node = $(`#${this.panel} #${id}`);
    assert(node, "Failed to find IME panel node by id:", id);
    return node;
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
    node.addEventListener('keydown', (evt) => {
      let r = this.dispatch("KeyEvent", this.engineID, evt);
      debug("keydown:", node, evt, r);

      if (r)
        evt.preventDefault();
      return !r;
    });
    node.addEventListener('keyup', (evt) => {
      debug("keyup:", node, evt);
      this.dispatch("KeyEvent", this.engineID, evt);
    });
    node.addEventListener('focus', (evt) => {
      debug("focus:", node, evt);
      return this.dispatch("Focus", {contextID: this.getContextID(node)});
    });
    node.addEventListener('blur', (evt) => {
      debug("blur:", node, evt);
      return this.dispatch('Blur', this.getContextID(node));
    });
  }

  clearComposition(parameters, callback) {
    let node = this.getNode('composition');
    node.empty();
    return true;
  };

  commitText(parameters, callback) {
    /*
     * The browsers no longer support changing input contents using TextEvent,
     * so we have to manually set the value and then fire the IntputEvent.
     */
    let text = parameters.text;
    let node = this.contexts[parameters.contextID];  /* or, document.activeElemnt */
    const newpos = node.selectionStart + text.length;
    const value = node.value;
    const prefix = value.slice(0, node.selectionStart);
    const postfix = value.slice(node.selectionEnd);
    node.value = `${prefix}${text}${postfix}`;
    node.selectionStart = node.selectionEnd = newpos;
    if (InputEvent) {
      let ev = new InputEvent("input", {data: text, inputType: "insertText"});
      node.dispatchEvent(ev);
    }
    return true;
  }

  // TODO(hungte) Bind CandidateClicked.
  setCandidates(parameters, callback) {
    let node = this.getNode('candidates');
    node.empty().append(NBSP);
    for (let c of parameters.candidates) {
      let label = c.label || c.id;
      let candidate = `${c.candidate} `;
      node.append($('<span/>', {text: candidate, class: "candidate"}).
          prepend($('<span/>', {text: label, class: "candidate_label"})));
    }
    return true;
  }

  setCandidateWindowProperties(parameters, callback) {
    let p = parameters.properties;
    if ('auxiliaryText' in p) {
      let node = this.getNode('auxiliary');
      node.text(`|${NBSP}${p.auxiliaryText}${NBSP}`).
        prepend($('<span/>').css({color: '#444'}).
          text(`${_("imeToggleHint")}${NBSP}`));
    }
    if ('auxiliaryTextVisible' in p) {
      let node = this.getNode('auxiliary');
      node.toggle(p.auxiliaryTextVisible);
    }
    if ('visible' in p) {
      let node = this.getNode('candidates')
      let body = $('body');
      node.toggle(p.visible);
      if (p.visible)
        body.css({opacity: 1.0});
    }
    return true;
  }

  setComposition(parameters, callback) {
    let node = this.getNode('composition');
    let p = parameters;
    const simple = true;
    let text = p.text || '';

    // A simple implementation when we don't IMs like libchewing.
    if (simple) {
      node.text(`${text}${NBSP}`)
      return true;
    }

    let selectionStart = p.selectionStart || 0;
    let selectionEnd = p.selectionEnd || text.length;
    let cursor = p.cursor || text.length;
    let segments = p.segments || [];

    let data = text.split('').map((c) => ({text: c}));
    data.push({text: NBSP});
    data[cursor].cursor = true;
    for (let i = selectionStart; i < selectionEnd; i++) {
      data[i].selected = true;
    }
    for (let i in segments) {
      for (let idx = segments[i].start; idx < segments[i].end; idx++) {
        data[idx].segment = (i + 1);
      }
    }

    node.empty();
    let span = $('<span/>');
    let segi;
    for (let d of data) {
      if (d.segment != segi) {
        // new segment.
        ui.append(span);
        segi = d.segment;
        span = $('<span/>');
        if (segi)
          span.attr('class', 'segment');
      }
      let newdata = document.createTextNode(d.text);
      if (d.cursor) {
        let cursor = $('<span class="cursor">');
        if (segi) {
          newdata = cursor.append(newdata);
        } else {
          span.append(cursor);
        }
      }
      span.append(newdata);
    }
    node.append(span);
    return true;
  }

  setMenuItems(parameters, callback) {
    let node = this.getNode('menu');
    node.empty();
    for (let i of parameters.items) {
      let label = i.label || i.id;
      if (i.checked)
        label = `> ${label}`;
      node.append(
        $('<li/>', {text: label}).click(() => {
          this.dispatch(
            'MenuItemActivated', this.engineID, i.id);
        }));
    }
    return false;
  }

  updateMenuItems(parameters, callback) {
    return this.setMenuItems(parameters, callback);
  }
}
