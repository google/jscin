// Copyright 2013 Google Inc. All Rights Reserved.

/**
 * @fileoverview "Related text" Addon
 * @author hungte@google.com (Hung-Te Lin)
 */

import { jscin } from "./jscin.js";
import { BaseInputAddon } from "./base_addon.js";

import { AddLogger } from "./logger.js";
const {log, debug, info, warn, error, assert, trace} = AddLogger("addon.RelatedText");

export class AddonRelatedText extends BaseInputAddon
{
  constructor(name, im)
  {
    super(name, im);
    this.last_mcch = undefined;
    // last_selkey should not be undefined/null otherwise if ctx.selkey was
    // never defined then we won't even notice it in the first execution.
    this.last_selkey = '';
    this.expected_keys = []; // decide later when ctx.selkey is available.
  }

  /*
   * Maintains the mapping between keys and shifted keys.
   * Does not include keys that remain the same in shift mode.
   */
  RefreshShiftMap(ctx) {
    if (ctx.selkey == this.last_selkey)
      return;

    let keys = ctx.selkey;
    this.last_selkey = keys;

    /* This mapping is based on en-us layout, but we don't have a better way to
     * support the shift map.
     */
    const input =  "`1234567890-=[];',./\\";
    const output = '~!@#$%^&*()_+{}:"<>?|';
    let shift_map = {};

    for (let i in input) {
      shift_map[input[i]] = output[i];
      shift_map[input[i]] = output[i];
    }
    for (let i='a'.charCodeAt(0); i <= 'z'.charCodeAt(0); i++) {
      let v = String.fromCharCode(i);
      shift_map[v] = v.toUpperCase();
    }
    this.expected_keys = keys.split('').filter(
        v => v in shift_map).map(v => shift_map[v]);
    debug("RefreshShiftMap", this.expected_keys);
  }

  keystroke(ctx, ev)
  {
    debug("Check key code = ", ev.code);
    if (!ctx.allow_related_text || jscin.has_ctrl_alt_meta(ev)||
        ev.key == 'Shift')
      return this.im.keystroke(ctx, ev);

    this.RefreshShiftMap(ctx);
    if (this.last_mcch && ev.type == 'keydown' && ctx.mcch === this.last_mcch) {
      ctx.mcch = '';
      let k = jscin.get_unshifted_key(ev);
      debug("Unshifted:", k);
      if ((ev.shiftKey || ctx.auto_compose) &&
          this.InSelectionKey(ctx, k) &&
          this.CommitCandidate(ctx, k)) {
        debug("Commited.");
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

  get_accepted_keys(ctx)
  {
    let keys = this.im.get_accepted_keys(ctx);
    if (!ctx.allow_related_text)
      return keys;

    this.RefreshShiftMap(ctx);
    return keys.concat(this.expected_keys);
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
