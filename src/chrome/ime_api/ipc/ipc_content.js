// Copyright 2024 Google Inc. All Rights Reserved.

/**
 * @fileoverview A Chrome extension based provider for chrome.input.ime.
 * @author hungte@google.com (Hung-Te Lin)
 */

import { AddLogger } from "../../jscin/logger.js";
const {log, debug, info, warn, error, assert, trace, logger} = AddLogger("ipc/ipc_content");

import { hasCtrlAltMeta } from "../../jscin/key_event.js";
import { $, jQuery } from "../../jquery/jquery.js";
import { IpcIme } from "./ipc.js";

export class IpcContentIme extends IpcIme {

  constructor(panel='ime_api/ipc/ime_panel.html') {

    const seed = Math.round(Math.random() * 65530);
    const seeded_panel = `${panel}?seed=${seed}`;
    super(seeded_panel, seed);

    this.engineID = "jscin.chrome.input.ime.extension";
    this.enabled = false;
    this.waitForHotkeyUp = false;

    // Change panel to a real created DOM node.
    this.panel_node = this.createPanel(this.panel);

    this.initialize();
  }

  initialize() {
    super.initialize();

    this.forwardEventToPanel("OpenOptionsPage");
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

  showPanel(show) {
    if (show === undefined)
      show = true;
    let panel = $(this.panel_node);
    if (show) {
      panel.finish();
      panel.fadeIn(100);
    } else {
      panel.finish();
      panel.fadeOut(100);
    }
  }
  hidePanel() {
    return this.showPanel(false);
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

    $(this.panel_node).css(offset);
  }

  attachPanel(node) {
    debug("attachPanel:", node);
    let offset = $(node).offset();
    let node_height = $(node).height();
    offset.node_height = node_height;
    this.movePanel(offset);
  }

  detachPanel() {
    this.hidePanel();
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    if (enabled) {
      debug("setEnabled: showFrame");
      this.showPanel();
    } else {
      debug("setEnabled: hideFrame");
      this.hidePanel();
    }
  }

  isHotKey(evt) {
    // Currently we want to use Shift (single click) as the hot key, so it
    // is either evt.code as ['ShiftLeft', 'ShiftRight'] or evt.key as 'Shift'.
    // https://www.w3.org/TR/uievents-key/, https://www.w3.org/TR/uievents-code/
    // Also, we can't check evt.shiftKey because that will be false when the key
    // is released (KeyUp).
    return evt.key == 'Shift' && !hasCtrlAltMeta(evt);
  }

  // DOM event listeners that can be overridden.

  domKeyDown(evt) {
    if (this.waitForHotkeyUp) {
      this.waitForHotkeyUp = false;
    } else if (this.isHotKey(evt)) {
      debug("Waiting for HotKey to release (keyup) as single-click...");
      this.waitForHotkeyUp = true;
      // Assume our IME doesn't need to handle single shift key.
    }

    if (!this.enabled)
      return true;
    return super.domKeyDown(evt);
  }
  domKeyUp(evt) {
    // Assume our IME won't do anything on key up, let's only check hotkeys.
    if (!this.waitForHotkeyUp)
      return;
    this.waitForHotkeyUp = false;

    if (this.isHotKey(evt)) {
      debug("Got HotKey single-click:", evt.code, evt.key, this.enabled);
      this.setEnabled(!this.enabled);
    }

    if (!this.enabled)
      return true;
    return super.domKeyUp(evt);
  }
  domFocus(evt) {
    this.attachPanel(evt.target);
    super.domFocus(evt);
    if (!this.enabled)
      return;
    this.showPanel();
  }
  domBlur(evt) {
    if (!this.enabled)
      return;
    this.hidePanel();
    return super.domBlur(evt);
  }

  // Bridge calls to the IME panel
  setCandidates(parameters, callback) {
    this.sendCommandToPanel("setCandidates", parameters);
  }
  setCandidateWindowProperties(parameters, callback) {
    this.sendCommandToPanel("setCandidateWindowProperties", parameters);
  }
  setComposition(parameters, callback) {
    this.sendCommandToPanel("setComposition", parameters);
  }
  clearComposition(parameters, callback) {
    this.sendCommandToPanel("clearComposition", parameters);
  }
  setMenuItems(parameters, callback) {
    this.sendCommandToMenu("setMenuItems", parameters);
  }
}
