// Copyright 2013 Google Inc. All Rights Reserved.

/**
 * @fileoverview "Related text" Addon
 * @author hungte@google.com (Hung-Te Lin)
 */

import { jscin } from "./jscin.js";
import { LoadJSON } from "./storage.js";
import { BaseInputAddon } from "./base_addon.js";
import { getUnshiftedKey, hasCtrlAltMeta } from "./key_event.js";

import { AddLogger } from "./logger.js";
const {log, debug, info, warn, error, assert, trace} = AddLogger("addon.RelatedText");

// the phrases database is so large that we want to hold only one copy in the
// module level.
var phrases = undefined;

async function LoadPhrases(reload) {
  // Loading JSON directly from extension is ~36ms while loading from
  // localStorage or ChromeStorage is ~16ms. So let's read from the extension.
  phrases = await LoadJSON("tables/tsi.json");
}

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
    if (!ctx.AddonRelatedText || hasCtrlAltMeta(ev)||
        ev.key == 'Shift')
      return this.im.keystroke(ctx, ev);

    // Late loading phrases. No await, and we whope the users won't have
    // RelatedText in the first keystroke.
    if (phrases === undefined) {
      LoadPhrases();
    }

    this.RefreshShiftMap(ctx);
    if (this.last_mcch && ev.type == 'keydown' && ctx.mcch === this.last_mcch) {
      ctx.mcch = '';
      let k = getUnshiftedKey(ev);
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
    let candidates = phrases && phrases[text];
    if (!candidates)
      return false;

    // Update context to fill fake content.
    this.last_mcch = candidates.substring(0, ctx.selkey.length).split('');
    ctx.mcch = this.last_mcch;
    return true;
  }
}

jscin.registerAddon(AddonRelatedText);
