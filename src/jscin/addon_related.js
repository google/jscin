// Copyright 2013 Google Inc. All Rights Reserved.

/**
 * @fileoverview "Related text" Addon
 * @author hungte@google.com (Hung-Te Lin)
 */

import { jscin } from "./jscin.js";
import { BaseInputAddon } from "./base_addon.js";

export class AddonRelatedText extends BaseInputAddon
{
  constructor(name, im)
  {
    super(name, im);
    this.last_mcch = undefined;
  }

  keystroke(ctx, ev)
  {
    jscin.log("relatedText, check key code = ", ev.code);
    if (!ctx.allow_related_text || jscin.has_ctrl_alt_meta(ev)||
        ev.key == 'Shift')
      return this.im.keystroke(ctx, ev);

    if (this.last_mcch && ev.type == 'keydown' && ctx.mcch === this.last_mcch) {
      ctx.mcch = '';
      let k = jscin.get_key_val(ev.code);
      if ((ev.shiftKey || ctx.auto_compose) &&
          this.InSelectionKey(ctx, k) &&
          this.CommitCandidate(ctx, k)) {
        this.FindRelatedText(ctx);
        return jscin.IMKEY_COMMIT;
      }
    }
    let result = this.im.keystroke(ctx, ev);
    if (result != jscin.IMKEY_COMMIT || !this.IsEmptyContext(ctx))
      return result;
    this.FindRelatedText(ctx);
    return result;
  }

  InSelectionKey(ctx, key) {
    return ctx.selkey.includes(key);
  }

  IsEmptyContext(ctx) {
    return (!ctx.mcch || ctx.mcch.length == 0) && !ctx.keystroke;
  }

  CommitCandidate(ctx, key) {
    let index = ctx.selkey.indexOf(key);
    if (index >= this.last_mcch.length)
      return false;
    ctx.cch = this.last_mcch[index];
    return true;
  }

  FindRelatedText(ctx) {
    let text = ctx.cch;
    let candidates = ctx.phrases && ctx.phrases[text];
    if (!candidates)
      return false;

    // Update context to fill fake content.
    this.last_mcch = candidates.substr(0, ctx.selkey.length);
    ctx.mcch = this.last_mcch;
    return true;
  }
}

jscin.register_addon(AddonRelatedText);
