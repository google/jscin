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

    // TODO(hungte) use conf directly.
    this.keyname = conf.keyname;
    this.selkey = conf.selkey;
    this.endkey = conf.endkey;
  }

  // Called when the IM is first initialized.
  // If you need to use closure (for unnamed / private function), override and
  // define init, then expose entry point to "this".
  init(ctx)
  {
    this.reset_context(ctx);
    ctx.cch_publish = '';
  }

  // Called when IM or system wants to reset input context.
  reset_context(ctx)
  {
    // XCIN style interface.
    ctx.selkey = this.selkey;
    ctx.keystroke = '';
    ctx.suggest_keystroke = '';
    ctx.cch = '';
    ctx.mcch = [];
    ctx.lcch = [];
    ctx.edit_pos = 0;
    // The cch_publish should be initialized only one time, not in every
    // reset_context -- see init.
  }

  // Called when a new key event is sent to IM.
  keystroke(ctx, ev)
  {
    return jscin.IMKEY_UNKNOWN;
  }

  // Called when system wants to query corresponding key strokes for given text.
  show_keystroke(ctx, text) {
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

  // Called when terminates ongoing text input session without sending focus/blur
  // events, for example creating new tab / instance.
  reset(ctx)
  {
    let has_keystroke = (ctx.keystroke || '').length;
    let has_lcch = (ctx.lcch || []).length;
    let has_mcch = (ctx.mcch || []).length;

    if (has_lcch) {
      // Note: Chrome (emulation) will lose lcch.
      this.keystroke(ctx, this.GenKeyDownEvent('Enter', 'Enter'));
    } else if (has_keystroke || has_mcch) {
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
    trace('Terminating IM', this.name);
  }
}
