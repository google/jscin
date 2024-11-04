// Copyright 2024 Google Inc. All Rights Reserved.

/**
 * @fileoverview An iframe based provider for chrome.input.ime.
 * @author hungte@google.com (Hung-Te Lin)
 *
 * Note this is for content script to create a new iframe element, but the
 * IFrameIme itself runs in the content script context, not the iframe.
 *
 * content script -> iframe:  DOM(iframe).postMessage
 * iframe -> content script:  window.top.postMessage (chrome.runtime.sendMessage doesn't work)
 */

import { AddLogger } from "../../jscin/logger.js";
const {log, debug, info, warn, error, assert, trace} = AddLogger("iframe/content");

import { $, jQuery } from "../../jquery/jquery.js";
import { WebPageIme } from "../webpage.js";
import { ImeEventMessage, ImeCommandMessage } from "./ipc.js";

export class IFrameIme extends WebPageIme {

  constructor(panel='emulation/iframe/ime_panel.html') {
    super();
    this.engineID = "jscin.chrome.input.ime.iframe";
    this.show = false;
    this.enabled = false;
    this.panel = this.createPanel(panel);

    window.addEventListener("message", this.messageHandler.bind(this));
  }

  messageHandler(msg, sender) {
    let event = ImeEventMessage.fromObject(msg.data);
    if (!event) {
      debug("messageHandler: not a valid IME event message:", msg);
      return;
    }
    event.dispatch(this);
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
    let ref = document.getElementsByTagName('body')[0] || document.children[0];
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

  toIFrame(command, parameters) {
    this.getNode().postMessage(
      new ImeCommandMessage(command, parameters),
      '*');
  }

  // Bridge calls to the iframe
  setCandidates(parameters, callback) {
    this.toIFrame("setCandidates", parameters);
  }
  setCandidateWindowProperties(parameters, callback) {
    this.toIFrame("setCandidateWindowProperties", parameters);
  }
  setComposition(parameters, callback) {
    this.toIFrame("setComposition", parameters);
  }
  clearComposition(parameters, callback) {
    this.toIFrame("clearComposition", parameters);
  }
  setMenuItems(parameters, callback) {
    this.toIFrame("setMenuItems", parameters);
  }
}
