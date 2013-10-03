// Copyright 2013 Google Inc. All Rights Reserved.

/**
 * @fileoverview "Related text" Addon
 * @author hungte@google.com (Hung-Te Lin)
 */

jscin.register_addon('AddonRelatedText', jscin.extend_input_method({
  constructor: function (name, im)
  {
    this.last_mcch = undefined;
  },

  keystroke: function (ctx, ev)
  {
    var self = this;

    function InSelectionKey(ctx, key) {
      return ctx.selkey.indexOf(key) >= 0;
    }

    function IsEmptyContext(ctx) {
      return (!ctx.mcch || ctx.mcch.length == 0) && !ctx.keystroke;
    }

    function CommitCandidate(ctx, key) {
      var index = ctx.selkey.indexOf(key);
      if (index >= self.last_mcch.length)
        return false;
      ctx.cch = self.last_mcch[index];
      return true;
    }

    function FindRelatedText(ctx) {
      var text = ctx.cch;
      var candidates = ctx.phrases && ctx.phrases[text];
      if (!candidates)
        return false;

      // Update context to fill fake content.
      self.last_mcch = candidates.substr(0, ctx.selkey.length);
      ctx.mcch = self.last_mcch;
      return true;
    }

    jscin.log("relatedText, key = ", ev.code);
    if (!ctx.allow_related_text || ev.ctrlKey || ev.altKey || k == 'Shift')
      return this.im.keystroke(ctx, ev);

    if (this.last_mcch && ev.type == 'keydown' && ctx.mcch === this.last_mcch) {
      ctx.mcch = '';
      var k = jscin.get_key_val(ev.code);
      if ((ev.shiftKey || ctx.auto_compose) &&
          InSelectionKey(ctx, k) &&
          CommitCandidate(ctx, k)) {
        FindRelatedText(ctx);
        return jscin.IMKEY_COMMIT;
      }
    }
    var result = this.im.keystroke(ctx, ev);
    if (result != jscin.IMKEY_COMMIT || !IsEmptyContext(ctx))
      return result;
    FindRelatedText(ctx);
    return result;
  },
}, jscin.base_input_addon));
