// Copyright 2013 Google Inc. All Rights Reserved.

/**
 * @fileoverview JSCIN Input Method Base Class.
 * @author hungte@google.com (Hung-Te Lin)
 */

// To store data in IM module:
// 'this (self)' should be read-only after constructor / init.
// 'ctx' (context) should store latest session data (dynamic data).

jscin.base_input_method = function(name, conf) {
  jscin.log('Creating IM', name, conf);
  this.name = name;
  // Read and parse from conf (a standard parsed CIN).
  this.cname = conf.cname || name;
  this.ename = conf.ename || name;
  this.keyname = conf.keyname || {};
  // Only table-commands (keyname, chardef) will be lowercased.
  // Any one line params must be normalized to lower case.
  this.selkey = (conf.selkey || '').toLowerCase();
  this.selkey2 = (conf.selkey2 || '').toLowerCase();
  this.endkey = (conf.endkey || '').toLowerCase();
}

// Called when the IM is first initialized.
// If you need to use closure (for unnamed / private function), override and
// define init, then expose entry point to "this".
jscin.base_input_method.prototype.init = function (ctx) {
  this.reset_context(ctx);
  ctx.cch_publish = '';
}

// Called when IM or system wants to reset input context.
jscin.base_input_method.prototype.reset_context = function (ctx) {
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
jscin.base_input_method.prototype.keystroke = function (ctx, ev) {
  return jscin.IMKEY_UNKNOWN;
}

// Called when system wants to query corresponding key strokes for given text.
jscin.base_input_method.prototype.show_keystroke = function (ctx, text) {
  return 'NOT IMPLEMENTED';
}

// Called when system wants to get a list of allowed key strokes.
// Note each value must follow jscin.get_key_description.
jscin.base_input_method.prototype.get_accepted_keys = function (ctx) {
  var keys = Object.keys(this.keyname || {}).concat(
      (this.endkey || '').split(''));
  var has_keystroke = (ctx.keystroke || '').length;
  var has_lcch = (ctx.lcch || []).length;
  var has_mcch = (ctx.mcch || []).length;

  // Standard rules.
  if (has_keystroke || has_lcch || has_mcch)
    keys = keys.concat([' ', 'Esc']);
  if (has_keystroke || has_lcch)
    keys = keys.concat(['Backspace']);
  if (has_lcch)
    keys = keys.concat(['Enter', 'Home', 'End']);
  if (has_mcch)
    keys = keys.concat((this.selkey || '').split(''));
  if (has_lcch || has_mcch)
    keys = keys.concat(['Up', 'Down', 'Left', 'Right']);

  return keys;
}

// Called when terminates ongoing text input session without sending focus/blur
// events, ex creating new tab / instance.
jscin.base_input_method.prototype.reset = function(ctx) {
  var has_keystroke = (ctx.keystroke || '').length;
  var has_lcch = (ctx.lcch || []).length;
  var has_mcch = (ctx.mcch || []).length;
  if (has_lcch) {
    // TODO(hungte) Directly commit lcch in future. A problem here is:
    //  - If we send Enter, Chrome will lose lcch.
    //  - If we don't send Enter, ChromeOS will send and keep lcch.
    // this.keystroke(ctx, { type: 'keydown', key: 'Enter', code: 'Enter' });
  } else if (has_keystroke || has_mcch) {
    this.keystroke(ctx, { type: 'keydown', key: 'Esc', code: 'Esc',
                          altKey: false, ctrlKey: false, shiftKey: false});
  }
}

// Provides a notifier for IM to invoke when context has been modified.
jscin.base_input_method.prototype.set_notifier = function (f) {
  this.notifier = f;
}

// Used by IM to notify system something is changed (see set_notifier).
jscin.base_input_method.prototype.notify = function () {
  if (this.notifier)
    return this.notifier();
}

// Called when then system is going to shutdown IM.
jscin.base_input_method.prototype.terminate = function (ctx) {
  trace('Terminating IM', this.name);
}
