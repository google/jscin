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

  constructor(panel='imePanel') {
    super();
    this.engineID = "jscin.chrome.input.ime.webpage";
    this.panel = panel;
    this.contexts = [];
    this.vertical = true;
    this.composition = undefined;
  }

  getNode(id) {
    const node = $(`#${this.panel} #${id}`);
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

    if (r)
      evt.preventDefault();
    return !r;
  }
  domKeyUp(evt) {
    debug("DOM keyup:", evt);
    this.onKeyEvent.dispatch(this.engineID, evt);
  }
  domFocus(evt) {
    debug("DOM focus:", evt.target, evt);
    return this.onFocus.dispatch({contextID: this.getContextID(evt.target)});
  }
  domBlur(evt) {
    debug("DOM blur:", evt.target, evt);
    if (this.composition)
      this.onReset.dispatch(this.getContextID(evt.target));
    return this.onBlur.dispatch(this.getContextID(evt.target));
  }

  // chrome.input.ime APIs

  async clearComposition(parameters) {
    debug("clearComposition", parameters);
    const node = this.getNode('composition');
    node.empty().append(NBSP);
    this.composition = undefined;
    return true;
  };

  async commitText(parameters) {
    /*
     * The browsers no longer support changing input contents using TextEvent,
     * so we have to manually set the value and then fire the IntputEvent.
     */
    const text = parameters.text;
    const node = this.contexts[parameters.contextID];  /* or, document.activeElemnt */
    const newpos = node.selectionStart + text.length;
    const value = node.value;
    const prefix = value.slice(0, node.selectionStart);
    const postfix = value.slice(node.selectionEnd);
    node.value = `${prefix}${text}${postfix}`;
    node.selectionStart = node.selectionEnd = newpos;
    if (InputEvent) {
      const ev = new InputEvent("input", {data: text, inputType: "insertText"});
      node.dispatchEvent(ev);
    }
    return true;
  }

  // TODO(hungte) Bind CandidateClicked.
  async setCandidates(parameters) {
    const node = this.getNode('candidates');
    node.empty();
    for (const c of parameters.candidates) {
      let label = c.label || c.id;
      let candidate = `${c.candidate} `;
      if (!c.candidate && c.annotation) {
        // Special workaround for CrOS showing background=textcolor in
        // horizontal mode.
        candidate = `${c.annotation} `;
        label = '';
      }
      if (this.vertical && label)
        label += ' ';
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
    if ('auxiliaryText' in p) {
      const node = this.getNode('auxiliary');
      const hint = this.vertical ? '' : _("imeToggleHint");
      node.text(`${NBSP}${p.auxiliaryText}${NBSP}`);
      if (hint)
        node.prepend($('<span/>').css({color: '#444'}).
          text(`${NBSP}${hint}|`));
    }
    if ('auxiliaryTextVisible' in p) {
      const node = this.getNode('auxiliary');
      node.toggle(p.auxiliaryTextVisible);
    }
    if ('visible' in p) {
      const node = this.getNode('candidates')
      node.toggle(p.visible);
      // TOOD(hungte) The 'body' below only works for the entire IME loaded as
      // iframe. Need a better way to handle showing / hiding the panel itself.
      const body = $('body');
      if (p.visible)
        body.css({opacity: 1.0});
    }
    if ('vertical' in p) {
      this.vertical = p.vertical;
    }
    return true;
  }

  async setComposition(parameters) {
    const node = this.getNode('composition');
    const p = parameters;
    const simple = true;
    const text = p.text || '';
    this.composition = text;

    // A simple implementation when we don't IMs like libchewing.
    if (simple) {
      node.text(`${text}${NBSP}`)
      return true;
    }

    const selectionStart = p.selectionStart || 0;
    const selectionEnd = p.selectionEnd || text.length;
    const cursor = p.cursor || text.length;
    let segments = p.segments || [];

    const data = text.split('').map((c) => ({text: c}));
    data.push({text: NBSP});
    data[cursor].cursor = true;
    for (let i = selectionStart; i < selectionEnd; i++) {
      data[i].selected = true;
    }
    for (const i in segments) {
      for (let idx = segments[i].start; idx < segments[i].end; idx++) {
        data[idx].segment = (i + 1);
      }
    }

    node.empty();
    let span = $('<span/>');
    let segi;
    for (const d of data) {
      if (d.segment != segi) {
        // new segment.
        node.append(span);
        segi = d.segment;
        span = $('<span/>');
        if (segi)
          span.attr('class', 'segment');
      }
      let newdata = document.createTextNode(d.text);
      if (d.cursor) {
        const cursor = $('<span class="cursor">');
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
        $('<div></div>', {text, class: className}).click(() => {
          this.onMenuItemActivated.dispatch(this.engineID, i.id);
        }));
    }
    return false;
  }

  async updateMenuItems(parameters) {
    return this.setMenuItems(parameters);
  }
}
