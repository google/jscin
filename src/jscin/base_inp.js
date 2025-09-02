// Copyright 2013 Google Inc. All Rights Reserved.

/**
 * @fileoverview JSCIN Input Method Base Class.
 * @author hungte@google.com (Hung-Te Lin)
 */

import { jscin } from "./jscin.js";

import { AddLogger } from "./logger.js";
const {log, debug, info, warn, error, assert, trace} = AddLogger("base_inp");

// To store data in IM module:
// 'this (self)' should be read-only after constructor / init.
// 'ctx' (context) should store latest session data (dynamic data).

export class BaseInputMethod
{
  constructor(name, conf)
  {
    this.name = name;

    // Read and parse from conf (a standard parsed CIN).
    this.cname = conf.cname || name;
    this.ename = conf.ename || name;

    this.keyname = conf.keyname || [];
    this.selkey = conf.selkey || '';
    this.endkey = conf.endkey || '';  // endkey is optional.
  }

  // Called when the IM is first initialized.
  // If you need to use closure (for unnamed / private function), override and
  // define init, then expose entry point to "this".
  init(ctx)
  {
    this.reset_context(ctx);
    ctx.cch_publish = '';
  }

  // Called when IM or system wants to reset input context, without creating a
  // new one (that will be only prepared in activating a new IM).
  reset_context(ctx)
  {
    // XCIN style interface.
    ctx.selkey = this.selkey;
    ctx.keystroke = '';  // compoisition
    ctx.cch = '';  // the string to commit
    ctx.mcch = [];  // multi-char list (candidates)
    ctx.lcch = [];  // composed cch list, e.g., edit buffer in Smart IMs
    ctx.edit_pos = 0;  // cursor in the edit buffer.
    // The cch_publish should be initialized only one time, not in every
    // reset_context -- see init.
  }

  // Called when a new key event is sent to IM.
  keystroke(ctx, ev)
  {
    debug("base_inp.keystroke", ctx, ev);
    return jscin.IMKEY_UNKNOWN;
  }

  // Called when system wants to query corresponding key strokes for given text.
  show_keystroke(ctx, text) {
    debug("base_inp.show_keystroke", ctx, text);
    return 'NOT IMPLEMENTED';
  }

  // Utility function to generate a key event.
  GenKeyDownEvent(key, code) {
    return {
      type: 'keydown',
      key: key,
      code: code,
      ctrlKey: false,
      shiftKey: false,
      altKey: false,
      metaKey: false
    };
  }

  // `reset` is invoked when the IME provider interrupts an incomplete text
  // input context (e.g., something still in the composition buffer) so the IM
  // may want to clean up or send out the buffer as remaining text.
  //
  // In `chrome.input.ime`, onReset->reset is only invoked when has_keystroke.
  // However, in Manifest V3, the onReset is async so we actually can't send out
  // (commitText) anything or changing the UI.
  // `reset` does not automatically call reset_context, which the later should be
  // done separately when the IM is losing the context (e.g., onBlur).
  reset(ctx)
  {
    let has_keystroke = (ctx.keystroke || '').length;
    let has_lcch = (ctx.lcch || []).length;
    let has_mcch = (ctx.mcch || []).length;

    if (has_keystroke || has_lcch || has_mcch) {
      // Assuming most IMs will consider Escape = Cancel/reset all states.
      this.keystroke(ctx, this.GenKeyDownEvent('Escape', 'Escape'));
    }
  }

  // Provides a notifier for IM to invoke when context has been modified.
  set_notifier(f)
  {
    this.notifier = f;
  }

  // Used by IM to notify system something is changed (see set_notifier).
  notify()
  {
    if (this.notifier)
      return this.notifier();
  }

  // Called when then system is going to shutdown IM.
  terminate(ctx)
  {
    trace('Terminating IM', this.name, ctx);
  }
}
