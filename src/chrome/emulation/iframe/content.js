// Copyright 2024 Google Inc. All Rights Reserved.

/**
 * @fileoverview An iframe based provider for chrome.input.ime.
 * @author hungte@google.com (Hung-Te Lin)
 *
 * Note this is for content script to create a new iframe element, but the
 * IFrameIme itself runs in the content script context, not the iframe.
 *
 */

import { AddLogger } from "../../jscin/logger.js";
const {log, debug, info, warn, error, assert, trace, logger} = AddLogger("iframe/content");

import { $, jQuery } from "../../jquery/jquery.js";
import { WebPageIme } from "../webpage.js";
import { ImeMessage } from "./ipc.js";

export class IFrameIme extends WebPageIme {

  constructor(panel='emulation/iframe/ime_panel.html') {
    super();
    this.engineID = "jscin.chrome.input.ime.iframe";
    this.show = false;
    this.enabled = false;
    this.panel = this.createPanel(panel);
    this.ipc = new ImeMessage(this);

    this.initialize();
  }

  async initialize() {
    await this.ipc.initialize();
  }

  createPanel(url) {
    let frame = document.createElement("iframe");
    const frameURL = chrome.runtime.getURL(url);
    // the attributes of the iframe itself can only be set from the top level.
    frame.setAttribute("src", frameURL);
    frame.setAttribute("scrolling", "no");
    frame.setAttribute("frameBorder", 0);
    frame.setAttribute("allowTransparency", true);
    frame.style.backgroundColor = "transparent";
    frame.style.border = 0;
    frame.style.display = "none";
    frame.style.padding = 0;
    frame.style.position = "absolute";
    frame.style.width = "32em";
    frame.style.height = "100%";
    frame.style.zIndex = 999999;
    let [ref] = document.getElementsByTagName('body') || document.children;
    ref.appendChild(frame);
    return frame;
  }

  getNode() {
    return this.panel.contentWindow;
  }

  attach(node) {
    super.attach(node);
    node.addEventListener('focus', (evt) => {
      this.togglePanel(true);
      this.attachPanel(node);
    });
    node.addEventListener('blur', (evt) => {
      this.togglePanel(false);
    });
  }

  togglePanel(show) {
    if (typeof(show) == 'undefined')
      show = !this.show;
    let panel = $(this.panel);
    if (show) {
      panel.finish();
      panel.fadeIn(100);
    } else {
      panel.finish();
      panel.fadeOut(100);
    }
    this.show = show;
  }

  getPageHeight() {
    let b = document.body;
    let e = document.documentElement;
    return Math.max(b.scrollHeight, e.scrollHeight,
        b.offsetHeight, e.offsetHeight,
        b.clientHeight, e.clientHeight);
  }

  getPageWidth() {
    let b = document.body;
    let e = document.documentElement;
    return Math.max(b.scrollWidth, e.scrollWidth,
        b.offsetWidth, e.offsetWidth,
        b.clientWidth, e.clientWidth);
  }

  movePanel(offset) {
    // Calculate where is the best place to show IME frame, to prevent moving
    // that outside top level DOM (ex, chat windows).
    let min_width = 300, min_height = 150;
    if (offset.top + offset.node_height + min_height > this.getPageHeight())
      offset.top -= min_height;
    else
      offset.top += offset.node_height + 5;

    if (offset.left + min_width > this.getPageWidth())
      offset.left = this.getPageWidth() - min_width;
    else
      offset.left += 5;
    debug("movePanel, page WxH:", this.getPageWidth(), this.getPageHeight(),
          ", final:", offset);

    $(this.panel).css(offset);
  }

  attachPanel(node) {
    debug("attachPanel:", node);
    let offset = $(node).offset();
    let node_height = $(node).height();
    offset.node_height = node_height;
    this.movePanel(offset);
  }

  detachPanel() {
    this.togglePanel(false);
  }

  toPanel(command, parameters) {
    this.ipc.Command(command, parameters).sendToPanel();
  }

  // Bridge calls to the iframe
  setCandidates(parameters, callback) {
    this.toPanel("setCandidates", parameters);
  }
  setCandidateWindowProperties(parameters, callback) {
    this.toPanel("setCandidateWindowProperties", parameters);
  }
  setComposition(parameters, callback) {
    this.toPanel("setComposition", parameters);
  }
  clearComposition(parameters, callback) {
    this.toPanel("clearComposition", parameters);
  }
  setMenuItems(parameters, callback) {
    this.toPanel("setMenuItems", parameters);
  }
}
