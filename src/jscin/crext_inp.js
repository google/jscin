// Copyright 2013 Google Inc. All Rights Reserved.

/**
 * @fileoverview ChromeExtension-based Input Method Module
 * @author hungte@google.com (Hung-Te Lin)
 */

jscin.register_module('CrExtInp', jscin.extend_input_method({

  constructor: function (name, conf)
  {
    var self = this;
    self.opts = {
      OPT_KEEP_KEY_CASE: conf.keep_key_case
    };
    self.extension_id = conf.EXTENSION_ID;

    var flag = parseInt(conf.flag || "0");
    if (flag & 0x1) { // FLAG_KEEP_KEY_CASE
      self.opts.OPT_KEEP_KEY_CASE = true;
    }

    jscin.external.init_ime(self.extension_id, {
      keystroke: function (result, ctx) {
        jscin.log("crext_inp received new response", result, ctx);
        self.ctx.keystroke = ctx.keystroke || '';
        self.ctx.mcch = ctx.mcch || '';
        self.ctx.cch = ctx.cch || '';
        self.ctx.lcch = ctx.lcch || [];
        self.ctx.edit_pos = ctx.edit_pos;
        self.notify();
      }});
  },

  init: function (ctx)
  {
    var ret = this.super.init.apply(this, arguments);
    // Enforce checking all accepted keys.
    ctx.check_accepted_keys = true;
    return ret;
  },

  keystroke: function (ctx, ev)
  {
    var self = this;
    jscin.log("crext_inp: keystroke", ctx, ev);
    jscin.external.send_keystroke_command(ctx, ev, self.extension_id);
    // TODO prevent race condition.
    self.ctx = ctx;
    return jscin.IMKEY_DELAY;
  }
}));
