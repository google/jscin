// Copyright 2013 Google Inc. All Rights Reserved.

/**
 * @fileoverview "Related text" Module
 * @author hungte@google.com (Hung-Te Lin)
 */

ModRelatedText = function(im) {
  var self = this;
  self.im = im;
  self.last_mcch = undefined;

  function InSelectionKey(ctx, key) {
    return ctx.selkey.toUpperCase().indexOf(key.toUpperCase()) >= 0;
  }

  function IsEmptyContext(ctx) {
    return !ctx.mcch && !ctx.keystroke;
  }

  function CommitCandidate(ctx, key) {
    var index = ctx.selkey.toUpperCase().indexOf(key.toUpperCase());
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

  self.onKeystroke = function(ctx, ev) {
    var key = jscin.get_key_val(ev.code);

    jscin.log("relatedText, key = ", key);
    if (!ctx.allow_related_text || ev.ctrlKey || ev.altKey || key == 'Shift')
      return self.im.onKeystroke(ctx, ev);

    if (self.last_mcch && ev.type == 'keydown' && ctx.mcch === self.last_mcch) {
      ctx.mcch = '';
      if ((ev.shiftKey || ctx.auto_compose) &&
          InSelectionKey(ctx, key) &&
          CommitCandidate(ctx, key)) {
        FindRelatedText(ctx);
        return jscin.IMKEY_COMMIT;
      }
    }

    var result = im.onKeystroke(ctx, ev);
    if (result != jscin.IMKEY_COMMIT || !IsEmptyContext(ctx))
      return result;

    FindRelatedText(ctx);
    return result;
  }

  return self;
}

// Entry stub
jscin.register_addon('RelatedText', ModRelatedText);
