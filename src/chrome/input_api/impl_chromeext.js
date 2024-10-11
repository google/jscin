// Copyright 2013 Google Inc. All Rights Reserved.

/**
 * @fileoverview Implementation bindings for attaching to Chrome Extension.
 * @author hungte@google.com (Hung-Te Lin)
 */
// TODO(hungte) Change iframe IME UI to page popup.

import { ImeEvent } from "./ime_event.js";
import { jscin } from "../jscin/jscin.js";
import { $, jQuery } from "../jquery/jquery.js";

export class ChromeInputImeExtension {

  constructor() {
    this.engineID = "chrome_input_ime#impl#chromeext";
    this._debug = false;
  }

  log(...args) {
    console.log("[impl_chromext]", ...args);
  }

  debug(...args) {
    if (!this._debug)
      return;
    this.log(...args);
  }
}

export class ChromeInputImeExtensionBackground extends ChromeInputImeExtension {

  constructor(ime_api) {
    super();

    this.ime_api = ime_api;

    let ipc = new ImeEvent.ImeExtensionIPC('background');
    this.ipc = ipc;
    ipc.attach();

    this.StartListeners();
  }

  attach() {
    this.debug("Nothing to attach in background.");
  }

  ShowPageAction() {
    chrome.tabs.getSelected(null, (tab) => { chrome.pageAction.show(tab.id); });
  }

  StartListeners() {
    let ime_api = this.ime_api;

    // Setup menu
    ime_api.onActivate.addListener(() =>                { this.ShowPageAction();});

    // Forward UI events to IME Frame.
    // Menu is installed by page action window.
    ime_api.onUiComposition.addListener((arg) =>        { this.ipc.send("UiComposition", arg); });
    ime_api.onUiCandidates.addListener((arg) =>         { this.ipc.send("UiCandidates", arg); });
    ime_api.onUiCandidateWindow.addListener((arg) =>    { this.ipc.send("UiCandidateWindow", arg); });
    ime_api.onBlur.addListener((contextID) =>           { this.ipc.send("Blur", contextID); });
    ime_api.onImplAcceptedKeys.addListener((keys) =>    { this.ipc.send("ImplAcceptedKeys", keys); });

    ime_api.onFocus.addListener((context, guid) =>      {
      // BUG: Try harder to show page action, if haven't.
      this.ShowPageAction();
      // Notify content.js new context results.
      this.ipc.send("Focus", context, guid);
    });

    ime_api.onImplCommitText.addListener(
      (contextID, text) => { this.ipc.send("ImplCommitText", contextID, text); });

    this.ipc.listen({
      IpcGetSystemStatus: () => {
        this.debug("IpcGetSystemStatus");
        return {
          enabled: croscin.instance.prefGetSupportNonChromeOS(),
          debug: croscin.instance.debug }; }
    }, (...args) => {
      this.debug("IPC uncaught event (will send to IME API):", args);
      return this.ime_api.dispatchEvent(...args);
    });
  }
}

export class ChromeInputImeExtensionContent extends ChromeInputImeExtension {

  constructor(f) {
    super();

    // Variables.
    this.frame = undefined;
    this.contextID = undefined;
    this.ipc = undefined;
    this.enabled = undefined;
    this.toggleHotKey = 16;  // Shift.
    this.waitForHotkey = false;
    this.attached = [];
    this.frame_factory = f;

    let ipc = new ImeEvent.ImeExtensionIPC('content');
    this.ipc = ipc;
    ipc.attach();

    this.SendMessage('IpcGetSystemStatus', (result) => {
      this.debug("IpcGetSystemStatus received:", result, window.self.location);
      this._debug = result.debug;
      if (!result.enabled) {
        this.debug("IpcGetSystemStatus: disable.\n");
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
    this.debug("SetEnabled", enabled);
    if (typeof(this.enabled) == 'undefined') {
      // First time setting enabled.
      this.enabled = enabled;
    } else {
      // Apparently user is already doing something.
      this.enabled = enabled;
      if (enabled) {
        this.debug("setEnabled: showFrame");
        this.showFrame();
      } else {
        this.debug("setEnabled: hideFrame");
        this.hideFrame();
      }
    }
  }

  KeyUpEventHandler(ev) {
    // Assume our IME won't do anything on key up, let's only check hotkeys.
    if (!this.waitForHotkey)
      return;

    if (ev.keyCode == this.toggleHotKey) {
      this.debug("Got toggle hot key!", this.enabled);
      this.SetEnabled(!this.enabled);
    }
    this.waitForHotkey = false;
  }

  KeyDownEventHandler(ev) {
    if (this.waitForHotkey)
      this.waitForHotkey = false;

    if (ev.keyCode == this.toggleHotKey && !ev.ctrlKey && !ev.altKey) {
      this.debug("Wait to check toggle hotkey!");
      this.waitForHotkey = true;
      // Assume our IME don't need to handle single shift key.
      return;
    }

    if (!this.enabled)
      return;

    let ev2 = ImeEvent.ImeKeyEvent(ev);
    let node = ev.target;
    this.debug("impl.KeyDownEventHandler", ev, ev2);

    if (this.im_accepted_keys) {
      let desc = jscin.get_key_description(ev2);

      if (this.im_accepted_keys.indexOf(desc) >= 0) {
        ev.preventDefault();
        ev.stopPropagation();
        this.SendMessage('KeyEvent', this.engineID, ev2);
      }
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
    // TODO(hungte) Rewrite with window.getSelection
    let ev = document.createEvent("TextEvent");
    ev.initTextEvent("textInput", true, true, window, text);
    node.dispatchEvent(ev);
  }

  FocusHandler(ev) {
    let node = ev.target;
    this.debug("FocusHandler", ev.target, document.activeElement);
    this.node = node;
    this.guid = jscin.guid();
    this.SendMessage("ImplFocus", this.guid);
  }

  BlurHandler(ev) {
    // Note you can't send TextEvent now because it will also set focus to
    // target node.
    this.debug("BlurHandler", ev.target, document.activeElement);
    if (this.contextID)
      this.SendMessage("ImplBlur", this.contextID);
  }

  FindElementByFrame(frame) {
    let nodes = document.getElementsByTagName('iframe');
    for (let i = 0, len = nodes.length; i < len; i++) {
      if (nodes[i].contentWindow == frame)
        return nodes[i];
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
    return this.attached.indexOf(node) >= 0;
  }

  attach(node, fire) {
    if (this.attached.indexOf(node) < 0) {
      this.debug("impl.attach:", node, fire);
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
      this.debug("moveFrame - internal - ", offset, " scroll: ", scroll);
      offset.top -= scroll;
      return this.SendFrameMessage(window.parent, 'move', offset);
    }

    this.debug("moveFrame, orig:", offset);

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
    this.debug("moveFrame, page WxH:", this.getPageWidth(), this.getPageHeight(),
               ", final:", offset);

    this.frame.css(offset);
  }

  setInitNode(node) {
    this.init_node = node;
  }

  StartListeners() {

    this.ipc.listen({
      IpcUiReady: () => {
        this.debug("UIReady, engineID=", this.engineID);
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
          this.debug("Focus: showFrame");
          this.showFrame(true);
        }
      },

      Blur: (contextID) => {
        if (this.contextID) {
          this.debug("content on blur", this.contextID, contextID);
          if (this.enabled) {
            this.hideFrame();
            this.debug("hide frame");
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
