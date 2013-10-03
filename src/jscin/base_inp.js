// Copyright 2013 Google Inc. All Rights Reserved.

/**
 * @fileoverview JSCIN Input Method Base Class.
 * @author hungte@google.com (Hung-Te Lin)
 */

jscin.base_input_method = function(name, conf) {
  jscin.log('Creating IM', name, conf);
  this.name = name;
  // Read and parse from conf (a standard parsed CIN).
  this.cname = conf.cname || name;
  this.ename = conf.ename || name;
  this.keyname = conf.keyname || {};
  this.selkey = conf.selkey || ''; // probably also upper-cased.
  this.selkey2 = conf.selkey2 || '';
  this.endkey = conf.endkey || "";
}

// Called when the IM is first initialized.
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
jscin.base_input_method.prototype.keystroke = function (ctx, ev, k) {
  return jscin.IMKEY_UNKNOWN;
}

// Called when system wants to query corresponding key strokes for given text.
jscin.base_input_method.prototype.show_keystroke = function (ctx, text) {
  return 'NOT IMPLEMENTED';
}

// Called when system wants to get a list of allowed key strokes.
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
    keys = keys.concat(['Enter']);
  if (has_mcch)
    keys = keys.concat((this.selkey || '').split(''));
  if (has_lcch || has_mcch)
    keys = keys.concat(['Up', 'Down', 'Left', 'Right']);

  return keys;
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
