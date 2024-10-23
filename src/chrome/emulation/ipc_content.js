// Copyright 2013 Google Inc. All Rights Reserved.

/**
 * @fileoverview IPC Based Emulation - Content Host.
 * @author hungte@google.com (Hung-Te Lin)
 */

import { AddLogger } from "../jscin/logger.js";
const {log, debug, info, warn, error, assert, trace, logger} = AddLogger("ipc_content");

import { $, jQuery } from "../jquery/jquery.js";
import { getKeyDescription, hasCtrlAltMeta } from "../jscin/key_event.js";
import { ImeExtensionIPC } from "./ipc.js";

function CreateImeFrame () {
  let frame = document.createElement("iframe");
  const frameURL = chrome.runtime.getURL('emulation/ui.html');
  frame.setAttribute("src", frameURL);
  frame.setAttribute("scrolling", "no");
  frame.setAttribute("frameBorder", 0);
  frame.setAttribute("allowTransparency", true);
  frame.style.zIndex = 999999;
  frame.style.border = 0;
  frame.style.padding = 0;
  frame.style.width = "32em";
  frame.style.height = "11em";
  frame.style.position = "absolute";
  frame.style.backgroundColor = "transparent";
  frame.style.display = "none";
  let ref = document.getElementsByTagName('body')[0] || document.children[0];
  ref.appendChild(frame);
  return frame;
}

export class ContentIPCHost {

  constructor(window) {
    // Variables.
    this.engineID = "chrome_input_ime#impl#chromeext";
    this.frame = undefined;
    this.contextID = undefined;
    this.ipc = undefined;
    this.enabled = undefined;
    this.waitForHotkeyUp = false;
    this.attached = [];
    this.frame_factory = CreateImeFrame.bind(window);

    let ipc = new ImeExtensionIPC('content');
    this.ipc = ipc;
    ipc.attach();

    this.SendMessage('IpcGetSystemStatus', (result) => {
      debug("IpcGetSystemStatus received:", result, window.self.location);
      logger.enableAllLoggers(result.debug);
      debug("Chrome Extension Input Emulation", logger.getAllLoggers());
      if (!result.enabled) {
        debug("IpcGetSystemStatus: disable.\n");
        return;
      }
      this.SetFrame($(this.frame_factory()));
      this.SetEnabled(false);
      this.StartListeners();
    });
  }

  IsChildFrame() {
    return window.self !== window.top;
  }

  SendMessage(...args) {
    this.ipc.send(...args);
  }

  SetEnabled(enabled) {
    debug("SetEnabled", enabled);
    if (typeof(this.enabled) == 'undefined') {
      // First time setting enabled.
      this.enabled = enabled;
    } else {
      // Apparently user is already doing something.
      this.enabled = enabled;
      if (enabled) {
        debug("setEnabled: showFrame");
        this.showFrame();
      } else {
        debug("setEnabled: hideFrame");
        this.hideFrame();
      }
    }
  }

  IsHotKey(ev) {
    // Currently we want to use Shift (single click) as the hot key, so it
    // is either ev.code as ['ShiftLeft', 'ShiftRight'] or ev.key as 'Shift'.
    // https://www.w3.org/TR/uievents-key/, https://www.w3.org/TR/uievents-code/
    // Note 'in' does not work for arrays, only property keys so we have to use
    // 'array.includes' if we want to look at ev.code.
    // Also, we can't check ev.shiftKey because that will be false when the key
    // is released (KeyUp).
    return ev.key == 'Shift' && !hasCtrlAltMeta(ev);
  }

  KeyUpEventHandler(ev) {
    // Assume our IME won't do anything on key up, let's only check hotkeys.
    if (!this.waitForHotkeyUp)
      return;

    if (this.IsHotKey(ev)) {
      debug("Got toggle hot key:", ev.code, ev.key, this.enabled);
      this.SetEnabled(!this.enabled);
    }
    this.waitForHotkeyUp = false;
  }

  KeyDownEventHandler(ev) {
    if (this.waitForHotkeyUp)
      this.waitForHotkeyUp = false;
    else if (this.IsHotKey(ev)) {
      debug("Wait to check toggle hotkey!");
      this.waitForHotkeyUp = true;
      // Assume our IME doesn't need to handle single shift key.
      return;
    }

    if (!this.enabled)
      return;

    debug("KeyDownEventHandler", ev);
    let node = ev.target;
    if (!this.im_accepted_keys)
      return;

    const desc = getKeyDescription(ev);
    if (this.im_accepted_keys.includes(desc)) {
      ev.preventDefault();
      ev.stopPropagation();
      this.SendMessage('KeyEvent', this.engineID, ev);
    }
  }

  GetAbsoluteOffset(node) {
    let offset = { left: 0, 'top': 0};
    while (node) {
      // TODO(hungte) Handle if the node is inside a scrolled element.
      offset.left += node.offsetLeft;
      offset.top += node.offsetTop;
      node = node.offsetParent;
    }
    return offset;
  }

  ImplCommitText(node, text) {
    /*
     * The browsers no longer support changing input contents using TextEvent,
     * so we have to manually set the value and then fire the IntputEvent.
     */
    const newpos = node.selectionStart + text.length;
    const value = node.value;
    node.value = value.slice(0, node.selectionStart) + text + value.slice(node.selectionEnd);
    node.selectionStart = node.selectionEnd = newpos;
    if (InputEvent) {
      let ev = new InputEvent("input", {data: text, inputType: "insertText"});
      node.dispatchEvent(ev);
    }
  }

  getGuid() {
    function s4() {
      return Math.floor((1 + Math.random()) * 0x10000)
          .toString(16).substring(1);
    }
    return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
        s4() + '-' + s4() + s4() + s4();
  }

  FocusHandler(ev) {
    let node = ev.target;
    debug("FocusHandler", ev.target, document.activeElement);
    this.node = node;
    this.guid = this.getGuid();
    this.SendMessage("ImplFocus", this.guid);
  }

  BlurHandler(ev) {
    // Note you can't send TextEvent now because it will also set focus to
    // target node.
    debug("BlurHandler", ev.target, document.activeElement);
    if (this.contextID)
      this.SendMessage("ImplBlur", this.contextID);
  }

  FindElementByFrame(frame) {
    let nodes = document.getElementsByTagName('iframe');
    for (let n of nodes) {
      if (n.contentWindow == frame)
        return n;
    }
    return undefined;
  }

  SetFrame (frame) {
    this.frame = frame;
  }

  SendFrameMessage(view, command, arg) {
    view.postMessage({ ime: 'frame', command: command, arg: arg}, '*');
  }

  GetFrameMessage(ev) {
    if (!ev.data || ev.data.ime != 'frame')
      return undefined;
    return ev.data;
  }

  AddFrameOffset(offset, frame) {
    frame = this.FindElementByFrame(frame);
    if (!frame)
      return offset;
    let frame_offset = this.GetAbsoluteOffset(frame);
    offset.left += frame_offset.left;
    offset.top += frame_offset.top;
    return offset;
  }

  IsEditableNode(node) {
    return node && (node.nodeName == 'INPUT' || node.nodeName == 'TEXTAREA' ||
                    node.getAttribute('contenteditable'));
  }

  IsAttached(node) {
    return this.attached.includes(node);
  }

  attach(node, fire) {
    if (!this.attached.includes(node)) {
      debug("impl.attach:", node, fire);
      this.attached.push(node);
      node.addEventListener("focus", this.FocusHandler.bind(this));
      node.addEventListener("blur", this.BlurHandler.bind(this));
    }
    if (fire)
      this.FocusHandler({target: node});
  };

  showFrame(long_animation) {
    if (this.IsChildFrame())
      return this.SendFrameMessage(window.top, "show");
    this.frame.finish();
    this.frame.fadeIn(long_animation ? 250 : 100);
  }

  hideFrame() {
    if (this.IsChildFrame())
      return this.SendFrameMessage(window.top, 'hide');
    this.frame.finish();
    this.frame.fadeOut(100);
  }

  attachFrame(node) {
    // TODO(hungte) Make a better GetAbsoluteOffset that can deal with scroll
    // inside elements, and a better height() so we can get rid of jQuery...
    // Remember to try "reply in gmail long thread".
    let offset = $(node).offset(); // GetAbsoluteOffset(node);
    let node_height = $(node).height();
    offset.node_height = node_height;
    this.moveFrame(offset);
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

  moveFrame(offset) {
    if (this.IsChildFrame()) {
      let doc = document.documentElement;
      let scroll = (window.pageYOffset || doc.scrollTop) - (doc.clientTop || 0);
      debug("moveFrame - internal - ", offset, " scroll: ", scroll);
      offset.top -= scroll;
      return this.SendFrameMessage(window.parent, 'move', offset);
    }

    debug("moveFrame, orig:", offset);

    // Recalculate where is the best place to show IME frame, to prevent moving
    // that outside top level DOM (ex, chat windows).
    let min_width = 300, min_height = 150;
    if (offset.top + offset.node_height + min_height > this.getPageHeight())
      offset.top -= min_height;
    else
      offset.top += offset.node_height;

    if (offset.left + min_width > this.getPageWidth())
      offset.left = this.getPageWidth() - min_width;
    else
      offset.left += 5;
    debug("moveFrame, page WxH:", this.getPageWidth(), this.getPageHeight(),
               ", final:", offset);

    this.frame.css(offset);
  }

  setInitNode(node) {
    this.init_node = node;
  }

  StartListeners() {

    this.ipc.listen({
      IpcUiReady: () => {
        debug("UIReady, engineID=", this.engineID);
        this.SendMessage("Activate", this.engineID); // Update menu & pageAction.
      },

      ImplCommitText: (contextID, text) => {
        if (contextID != this.contextID)
          return;
        this.ImplCommitText(this.node, text);
      },

      ImplAcceptedKeys: (keys) => {
        this.im_accepted_keys = keys;
      },

      Focus: (context, guid) => {
        if (guid != this.guid)
          return;
        let node = this.node;
        this.contextID = context.contextID;

        this.attachFrame(node);
        if (this.enabled) {
          debug("Focus: showFrame");
          this.showFrame(true);
        }
      },

      Blur: (contextID) => {
        if (this.contextID) {
          debug("content on blur", this.contextID, contextID);
          if (this.enabled) {
            this.hideFrame();
            debug("hide frame");
          }
          this.contextID = undefined;
        }
      },

      MenuItemActivated:  (engineID, name) => {
        // (Legacy, when menu is included in iframe) forward to background.
        this.ipc.send("MenuItemActivated", engineID, name);
        SnapshotIME();
      }
    });

    window.addEventListener("message", (e) => {
      let msg = this.GetFrameMessage(e);
      if (!msg)
        return;

      switch (msg.command) {
        case 'hide':
          this.hideFrame();
          break;
        case 'show':
          this.showFrame();
          break;
        case 'move':
          this.moveFrame(this.AddFrameOffset(msg.arg, e.source));
          break;
      }
    });

    document.addEventListener("keydown", (ev) => {
      if (ev.target != this.node)
        return;
      return this.KeyDownEventHandler(ev);
    }, true);
    document.addEventListener("keyup", (ev) => {
      if (ev.target != this.node)
        return;
      return this.KeyUpEventHandler(ev);
    }, true);
    document.addEventListener("focusin", (ev) => {
      let node = ev.target;
      if (!this.IsEditableNode(node) || this.IsAttached(node))
        return;
      this.attach(node, true);
    });

    let node = document.activeElement;
    if (this.IsEditableNode(node)) {
      this.attach(node, true);
    }
  }
}
