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
    this.keyname = conf.keyname || {};

    // Only table-commands (keyname, chardef) will be lowercased.
    // Any one line params must be normalized to lower case.
    this.selkey = (conf.selkey || '').toLowerCase();
    this.endkey = (conf.endkey || '').toLowerCase();

    // Standard rules.
    let setArrow = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'],
      setPage = ['PageUp', 'PageDown'],
      setLineEdit = ['Enter', 'Home', 'End'],
      setEdit = ['Backspace'],
      setConvert = [' ', 'Escape'];

    let accepted_keys = {
      '*': Object.keys(this.keyname).concat(this.endkey.split('')),
      'keystroke': setConvert.concat(setEdit),
      'lcch': setConvert.concat(setEdit).concat(setArrow).concat(setLineEdit),
      'mcch': setConvert.concat(setPage).concat(setArrow).concat(this.selkey.split(''))
    };

    let keys = conf.ACCEPTED_KEYS || {};
    for (let k of Object.keys(keys)) {
      // syntax: key or 'key,'
      let val = keys[k];
      if (k.indexOf(',') > 0) {
        val = val.split(',');
        k = k.replace(',', '');
      } else {
        val = val.split('');
      }
      if (k in accepted_keys)
        val = accepted_keys[k].concat(val);
      accepted_keys[k] = val;
    }
    this.accepted_keys = accepted_keys;
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

  // TODO(hungte) See if we can move this into context.
  // Called when system wants to get a list of allowed key strokes.
  // Note each value must follow key_event.getKeyDescription.
  get_accepted_keys(ctx)
  {
    let has_keystroke = (ctx.keystroke || '').length;
    let has_lcch = (ctx.lcch || []).length;
    let has_mcch = (ctx.mcch || []).length;

    let keys = this.accepted_keys['*'];
    if (has_keystroke)
      keys = keys.concat(this.accepted_keys['keystroke']);
    if (has_lcch)
      keys = keys.concat(this.accepted_keys['lcch']);
    if (has_mcch)
      keys = keys.concat(this.accepted_keys['mcch']);

    debug("get_accepted_keys", has_keystroke, has_lcch, has_mcch, keys);
    return keys;
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
  // events, ex creating new tab / instance.
  reset(ctx)
  {
    let has_keystroke = (ctx.keystroke || '').length;
    let has_lcch = (ctx.lcch || []).length;
    let has_mcch = (ctx.mcch || []).length;

    if (has_lcch) {
      // TODO(hungte) Directly commit lcch in future. A problem here is:
      //  - If we send Enter, Chrome will lose lcch.
      //  - If we don't send Enter, ChromeOS will send and keep lcch.
      //  As a workaround, temporary allow behavior difference.
      if (ctx.commit_on_blur)
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
