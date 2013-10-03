// Copyright 2013 Google Inc. All Rights Reserved.

/**
 * @fileoverview JSCIN Input Method Base Class.
 * @author hungte@google.com (Hung-Te Lin)
 */

// TODO(hungte) Rewrite all function calls with func.apply.

jscin.base_input_addon = jscin.extend_input_method({
  constructor: function (name, im) {
    this.im = im;
  },

  init: function (ctx) {
    return this.im.init(ctx);
  },

  // Called when IM or system wants to reset input context.
  reset_context: function (ctx) {
    return this.im.reset_context(ctx);
  },

  keystroke: function (ctx, ev, k) {
    return this.im.keystroke(ctx, ev, k);
  },

  show_keystroke: function (ctx, text) {
    return this.im.show_keystroke(ctx, text);
  },

  get_accepted_keys: function (ctx) {
    return this.im.get_accepted_keys(ctx);
  },

  set_notifier: function (f) {
    return this.im.set_notifier(f);
  },

  notify: function () {
    return this.im.notify();
  },

  terminate: function (ctx) {
    return this.im.terminate(ctx);
  }
});
