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

  function CommitCandidate(ctx, key) {
    var index = ctx.selkey.toUpperCase().indexOf(key.toUpperCase());
    if (index >= ctx.mcch.length)
      return false;
    ctx.cch = ctx.mcch[index];
    return true;
  }

  function FindRelatedText(ctx) {
    var text = ctx.cch;
    var candidates = ctx.phrases && ctx.phrases[text];
    if (!candidates)
      return;

    // Update context to fill fake content.
    self.last_mcch = candidates.substr(0, ctx.selkey.length);
    ctx.mcch = self.last_mcch;
  }

  self.onKeystroke = function(ctx, ev) {
    if (!ctx.allow_related_text)
      return self.im.onKeystroke(ctx, ev);
    var key = jscin.unshift_key(ev.key);
    if (!ev.ctrlKey && !ev.altKey && ev.shiftKey &&
        ctx.mcch && ctx.mcch == self.last_mcch &&
        InSelectionKey(ctx, key) &&
        CommitCandidate(ctx, key)) {
      FindRelatedText(ctx);
      return jscin.IMKEY_COMMIT;
    }

    var result = im.onKeystroke(ctx, ev);
    if (result != jscin.IMKEY_COMMIT)
      return result;

    jscin.log("mod_related on COMMIT", ctx, ev);
    var text = ctx.cch;
    var candidates = ctx.phrases && ctx.phrases[text];
    if (!candidates)
      return result;

    FindRelatedText(ctx);
    return result;
  }

  return self;
}

// Entry stub
jscin.register_addon('RelatedText', ModRelatedText);
