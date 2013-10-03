// Copyright 2013 Google Inc. All Rights Reserved.

/**
 * @fileoverview JSCIN Input Method Base Class.
 * @author hungte@google.com (Hung-Te Lin)
 */

jscin.base_input_addon = function(name, im) {
  jscin.log('Creating Addon', name, im.name);
  this.im = im;
  this.name = name;
};

// Note currently addon.init is almost never called.

// Called when the IM is first initialized.
jscin.base_input_addon.prototype.init = function (ctx) {
  return this.im.reset_context.apply(this.im, arguments);
}

// Called when IM or system wants to reset input context.
jscin.base_input_addon.prototype.reset_context = function (ctx) {
  return this.im.reset_context.apply(this.im, arguments);
}

// Called when a new key event is sent to IM.
jscin.base_input_addon.prototype.keystroke = function (ctx, ev) {
  return this.im.keystroke.apply(this.im, arguments);
}

// Called when system wants to query corresponding key strokes for given text.
jscin.base_input_addon.prototype.show_keystroke = function (ctx, text) {
  return this.im.show_keystroke.apply(this.im, arguments);
}

// Called when system wants to get a list of allowed key strokes.
jscin.base_input_addon.prototype.get_accepted_keys = function (ctx) {
  return this.im.get_accepted_keys.apply(this.im, arguments);
}

// Provides a notifier for IM to invoke when context has been modified.
jscin.base_input_addon.prototype.set_notifier = function (f) {
  return this.im.set_notifier.apply(this.im, arguments);
}

// Used by IM to notify system something is changed (see set_notifier).
jscin.base_input_addon.prototype.notify = function () {
  return this.im.notify.apply(this.im, arguments);
}

// Called when then system is going to shutdown IM.
jscin.base_input_addon.prototype.terminate = function (ctx) {
  return this.im.terminate.apply(this.im, arguments);
}
