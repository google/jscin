// Copyright 2013 Google Inc. All Rights Reserved.

/**
 * @fileoverview General Input Method Module, Version 2 (from scratch).
 * @author hungte@google.com (Hung-Te Lin)
 */

// TODO(hungte) Indicators for candidates to show "composition state" or
// "selection only state".

import {jscin} from "./jscin.js";
import {hasCtrlAltMeta, normalizeKey} from "./key_event.js";
import {BaseInputMethod} from "./base_inp.js";
import {Trie} from "./trie.js";

import { AddLogger } from "./logger.js";
const {debug, warn, error, assert} = AddLogger("gen_inp2");

const QWER_KEYS_BY_COLUMN = [
  '1qaz', '2wsx', '3edc', '4rfv', '5tgb', '6yhn', '7ujm', '8ik,', '9ol.', '0p;/',
];

function ReverseIndexedGroups(g) {
  let r = {};
  for (const [i, data] of Object.entries(g)) {
    for (const c of data)
      r[c] = i;
  }
  return r;
}

const QWER_COLUMN_MAP = ReverseIndexedGroups(QWER_KEYS_BY_COLUMN);

export class GenInp2 extends BaseInputMethod
{
  constructor(name, conf)
  {
    super(name, conf);
    // Declaration of states
    this.STATE_COMPOSITION = 1;
    this.STATE_CANDIDATES = 2;
    this.NULL_CANDIDATE = conf.nullcandidate || '\u25a1';  // 25a1 was from gcin ar30 table.

    this.MAX_MATCH_PAGES = 20; // each page has self.selkey.length candidates
    this.GLOB_KEYS = '?*';

    // Read and parse from conf (a standard parsed CIN).
    this.table = conf.chardef || {};
    this.trie = undefined; // trie is created only if we need frequent partial match.
    this.max_composition = parseInt(conf.max_keystroke || "0");
    // Default values should come from `jscin.OPTS`.
    this.opts = {};

    // The table to override when converting composition to candidates.
    this.override_conversion = conf.KEYSTROKE_REMAP;
    // The table to override when composition is not explicitly converted.
    this.override_autocompose = conf.quick;
    this.keygroups = conf.KEYGROUPS;

    // Convert table commands to options.
    const opts_remap = {
      SPACE_AUTOUP: 'OPT_SPACE_AUTOUP',  // The SPACE_AUTOUP will be expanded later.
      SPACE_RESET: 'OPT_SPACE_RESET',
      AUTO_COMPOSE: 'OPT_AUTO_COMPOSE',
      AUTO_FULLUP: 'OPT_COMMIT_ON_FULL',
      AUTO_RESET: 'OPT_AUTO_RESET',
      AUTO_UPCHAR: 'OPT_AUTO_UPCHAR',
      END_KEY: 'OPT_END_KEY',
      WILD_ENABLE: 'OPT_WILD_ENABLE',
      SELKEY_SHIFT: 'OPT_SELKEY_SHIFT',
      flag_unique_auto_send: 'OPT_UNIQUE_AUTO',
      flag_disp_partial_match: 'OPT_PARTIAL_MATCH',
      space_auto_first_full: 'OPT_SPACE_FIRST_FULL',
    };

    for (const key in opts_remap) {
      if (key in conf)
        this.opts[opts_remap[key]] = conf[key];
    }

    if ('SPACE_AUTOUP' in conf) {
      let v = conf.SPACE_AUTOUP;
      const valid = jscin.SPACE_AUTOUP_VALUES.includes(v);
      assert(valid, "Unknown SPACE_AUTOUP:", v);
      if (!valid)
        v = jscin.SPACE_AUTOUP_DEFAULT;
      this.opts[`OPT_SPACE_AUTOUP_${v}`] = true;
      // OPT_SPACE_AUTOUP_NO,
      // OPT_SPACE_AUTOUP_YES,
      // OPT_SPACE_AUTOUP_ANY,
    }

    // Currently CIN stores most tables as simple strings.
    this._NormalizeTable(this.override_conversion);
    this._NormalizeTable(this.override_autocompose, this.NULL_CANDIDATE);
  }

  _NormalizeTable(t, nullc) {
    if (!t)
      return t;
    for (const k in t) {
      let v = t[k];
      if (typeof(v) == 'string')
        v = v.split('');
      if (nullc)
        v = v.map((c) => (c == nullc) ? null : c);
      t[k] = v;
    }
    return t;
  }

  reset_context(ctx)
  {
    super.reset_context(ctx);
    ctx.state = this.STATE_COMPOSITION;
    ctx.composition = '';
    ctx.commit = '';
    this.ClearCandidates(ctx);

    // Flag for addons.
    ctx.auto_compose = (
        this.opts.OPT_AUTO_COMPOSE || this.override_autocompose) ? true : false;
  }

  keystroke(ctx, ev)
  {
    return this.ProcessKeystroke(ctx, ev);
  }

  init(ctx)
  {
    super.init(ctx);
  }

  NotifyError(ctx) {
    // beep.
    debug("NotifyError", ctx);
  }

  ResultError(ctx, key) {
    // TODO(hungte) The SPACE_RESET here is actually incorrect - we should track
    // the last state and check SPACE in the entry to reset. Or split the error
    // in different modes (composition vs candidates list)
    if (this.opts.OPT_AUTO_RESET ||
      this.opts.OPT_SPACE_RESET && key == ' ') {
      this.NotifyError(ctx);
      this.ResetContext(ctx);
    } else {
      this.NotifyError(ctx);
    }
    return jscin.IMKEY_ERROR;
  }

  ResultProcessed(ctx) {
    if (ctx.state == this.STATE_CANDIDATES && ctx.mcch?.length)
      ctx.keystroke = ctx.mcch[0];

    debug("ResultProcessed", ctx);
    return jscin.IMKEY_ABSORB;
  }

  ResultIgnore(ctx) {
    debug("ResultIgnore", ctx);
    return jscin.IMKEY_IGNORE;
  }

  ResultCommit(ctx) {
    debug("ResultCommit", ctx);
    return jscin.IMKEY_COMMIT;
  }

  GetMatchLimit(pages=this.MAX_MATCH_PAGES) {
    return pages * this.GetSelKeyLength();
  }

  GetSelKeyLength() {
    return this.selkey.length;
  }

  Glob2Regex(pattern) {
    // assert GLOB_KEYS == '*?'.
    return new RegExp("^" + pattern
      .replace(new RegExp('([\\][\\\\./^$()!|{}+-])', "g"), "\\$1")
      .replace(/\?/g, ".").replace(/\*/g, ".*")
      + "$");
  }

  IsGlobPattern(pattern) {
    for (const k of this.GLOB_KEYS)
      if (pattern.includes(k))
        return true;
    return false;
  }

  IsGlobKey(key) {
    return this.GLOB_KEYS.includes(key);
  }

  ResetContext(ctx) {
    return this.reset_context(ctx);
  }

  ClearCandidates(ctx) {
    ctx.candidates = [];
    ctx.candidates_start_index = 0;
    ctx.mcch = [];
    ctx.page_prompt = '';
  }

  UpdateCandidates(ctx) {
    // Compatible with gen_inp.
    const i = ctx.candidates_start_index || 0;
    const c = ctx.candidates;
    const pageSize = this.GetSelKeyLength() || 10;
    const total = Math.ceil(c.length / pageSize);
    const now = Math.ceil((i + 1) / pageSize);

    ctx.mcch = c.slice(i, i + pageSize);
    ctx.page_prompt = (total > 1) ? `${now}/${total}` : '';
  }

  UpdateComposition(ctx) {
    debug("UpdateComposition", ctx.composition);
    // Exported to the croscin, just like gen_inp.
    ctx.keystroke = ctx.composition.split('').map(
      (c) => this.keyname[c] || c).join('');

    this.PrepareCandidates(ctx, true);
  }

  ShiftState(ctx, keep_index) {
    debug("ShiftState", ctx.state);
    switch (ctx.state) {
      case this.STATE_COMPOSITION:
        ctx.state = this.STATE_CANDIDATES;
        break;
      case this.STATE_CANDIDATES:
        ctx.state = this.STATE_COMPOSITION;
        break;
    }
    if (!keep_index)
      ctx.candidates_start_index = 0;
  }

  AddCandidates(ctx, list) {
    if (!list?.length)
      return false;
    ctx.candidates = ctx.candidates.concat(list);
    return true;
  }

  HasCandidates(ctx) {
    return ctx.candidates.length > 0;
  }

  IsSingleCandidate(ctx) {
    return ctx.candidates.length == 1;
  }

  IsUniqueCandidate(ctx) {
    // Checks if there is only 1 candidate (by partial match).
    const trie = this.GetTrie();
    const node = trie.find(ctx.composition);
    const result = node?.isLeaf() && node.get().length == 1;
    debug("IsUniqueCandidate: result:", result, ctx.composition);
    return result;
  }

  CanCycleCandidates(ctx) {
    return ctx.candidates.length > this.GetSelKeyLength();
  }

  CycleCandidates(ctx, direction) {
    const start = ctx.candidates_start_index;
    debug("CycleCandidates", ctx.candidates, start, direction);
    if (!this.CanCycleCandidates(ctx))
      return false;
    direction = direction || 1;
    const max = ctx.candidates.length;
    const cycle_size = this.GetSelKeyLength();
    let new_index = start + direction * cycle_size;
    if (new_index >= max) {
      new_index = 0;
    } else if (new_index < 0) {
      new_index = max - (max % cycle_size);
    }
    ctx.candidates_start_index = new_index;
    debug("CycleCandidates index:", 'old=', start, "new=", new_index);
    this.UpdateCandidates(ctx);
    return true;
  }

  GetTrie(table) {
    let trie;
    const t = table || this.table;

    if (!table) {
      // built-in
      trie = this.trie;
      if (trie)
        return trie;
    }

    debug("GetTrie: Constructing the new trie:", t);
    trie = new Trie();
    for (const [k, v] of Object.entries(t))
      trie.add(k, v);

    if (!table)  // Cache for the next time.
      this.trie = trie;
    return trie;
  }

  // This is not really partial match; it's partial group.
  GetPartialGroupCandidates(ctx, prefix) {
    prefix ||= ctx.composition;
    assert(prefix, "GetPartialGroupCandidates: prefix is empty");

    const trie = this.GetTrie();
    let node = trie.find(prefix);
    let r = [];
    if (!node)
      return r;

    // The results can be up to one page.
    const page_size = this.GetSelKeyLength();

    // Always start with 'full matched' candidates.
    const matched = node.get();
    if (matched)
      r = r.concat(matched);
    if (r.length >= page_size)
      return r;

    let all = {};
    node.aggregate((key, data) => {
      if (key)
        all[key] = data;
      return true;
    });

    r.length = page_size;
    let remains = [];

    // Try to put all candidaes in the right column
    for (const key of Object.keys(all).sort()) {
      if (!key)
        continue;

      const candidates = all[key];
      const col = QWER_COLUMN_MAP[key[0]];
      let occupied = false;
      if (!col) {
        debug("GetPartialGroupCandidates: Key outside the known Qwer map", key);
        occupied = true;
      } else if (r[col]) {
        debug("GetPartialGroupCandidates: Column already occupied", key, col, r);
        occupied = true;
      }
      if (occupied) {
        remains = remains.concat(candidates);
      } else {
        r[col] = candidates[0];
        remains = remains.concat(candidates.slice(1));
      }
    }

    // Put all remains in the empty slots.
    let last_idx = -1;
    for (const [idx, c] of r.entries()) {
      const ch = c || remains.shift();
      if (ch)
        last_idx = idx;
      r[idx] = ch;
    }
    r = r.slice(0, last_idx + 1);

    debug("Trie partial match:", prefix, node, r);
    return r;
  }

  GlobCandidates(ctx, pattern, table, limit) {
    const regex = this.Glob2Regex(pattern || ctx.composition);

    return this._MatchCandidates(ctx, (k) => {
      return regex.test(k);
    }, table, limit);
  }

  // Search for candidates by callback function.
  _MatchCandidates(ctx, matcher, table, limit) {
    let result = [];

    if (!table)
      table = this.table;
    if (!limit)
      limit = this.GetMatchLimit();

    // Currently looping with index is the fastest way to iterate an array.
    for (const k of Object.keys(table)) {
      if (!matcher(k))
        continue;
      result = result.concat(table[k]);
      if (result.length >= limit) {
        debug("MatchCandidates: too many candidates:", result.length, result);
        result = result.slice(0, limit);
        break;
      }
    }
    return result;
  }

  PrepareCandidates(ctx, autocompose_stage) {
    debug("PrepareCandidates", ctx.composition, "autocompose_stage:", autocompose_stage);
    const key = ctx.composition;
    this.ClearCandidates(ctx);

    if (!key) {
      // calling this.UpdateCandidates(ctx) was required, but today we always
      // modified the states in ClearCandidates.
      return false;
    }

    // Decide if we should prepare anything.
    const quick = this.override_autocompose;
    const is_quick = quick && !!quick[key];
    if (autocompose_stage) {
      // When AUTO_COMPOSE is turned off, only %quick (override_autocompose) may
      // still show the candidates (if matched).
      if (!this.opts.OPT_AUTO_COMPOSE && !is_quick)
        return false;
    }

    // Find which table we should use.
    let table = this.table;
    let override = undefined;
    let changed = false;

    const try_glob = this.opts.OPT_WILD_ENABLE && this.IsGlobPattern(key);
    const limit = this.GetMatchLimit();

    if (try_glob) {
      // Do nothing - ignore override and always use the original table.
    } else if (autocompose_stage) {
      override = quick;
    } else { // converted (candidates) stage.
      override = this.override_conversion;
    }
    if (override && override[key]) {
      table = override;
      changed = true;
    }

    // Now prepare the candidates.
    if (try_glob) {
      this.AddCandidates(ctx, this.GlobCandidates(ctx, key, table, limit));
      debug("PrepareCandidates: - glob", ctx.candidates);
    } else if ((this.opts.OPT_AUTO_COMPOSE && this.opts.OPT_PARTIAL_MATCH) && autocompose_stage && !changed) {
      // OPT_PARTIAL_MATCH only in auto compose stage and table NOT changed (if changed=quick).
      this.AddCandidates(ctx, this.GetPartialGroupCandidates(ctx, key));
      debug("PrepareCandidates: - partial match", ctx.candidates);
    } else {
      // Normal lookup (exact match).
      this.AddCandidates(ctx, table[key]);
      debug("PrepareCandidates: - exact match", ctx.candidates);
    }

    this.UpdateCandidates(ctx);
    return this.HasCandidates(ctx);
  }

  IsCompositionKey(ctx, key) {
    return (key in this.keyname) || (this.opts.OPT_WILD_ENABLE && this.IsGlobKey(key));
  }

  CanDoComposition(ctx, key) {
    // Some CIN tables like Array30 may include special keys (ex, selection
    // keys) as part of composition.
    if (this.table[ctx.composition + key])
      return true;
    return false;
  }

  HasComposition(ctx) {
    return ctx.composition.length > 0;
  }

  IsFullComposition(ctx) {
    return (this.max_composition &&
      ctx.composition.length >= this.max_composition);
  }

  GetCompositionKeyGroup(ctx, key) {
    const groups = this.keygroups;
    if (!groups)
      return undefined;
    for (const g in groups) {
      if (groups[g].includes(key))
        return g;
    }
    return undefined;
  }

  CreateCompositionByGroups(ctx, newgroup, key) {
    debug("CreateCompositionByGroups: new_grouop", newgroup);
    // modify composition to fit key groups.
    let key_by_group = {};
    for (const c of ctx.composition) {
      const cg = this.GetCompositionKeyGroup(ctx, c);
      // If any composition is not grouped, abort.
      if (!cg)
        return false;
      key_by_group[cg] = c;
    }
    debug("CreateCompositionByGroups key_by_group", key_by_group, newgroup, key);
    key_by_group[newgroup] = key;
    let v = '';
    for (const g of Object.keys(key_by_group).sort()) {
      v += key_by_group[g];
    }
    ctx.composition = v;
    return true;
    // TODO(hungte) Make an index for DelComposition to delete last entered
    // key, or only update the displayed composition.
  }

  AddComposition(ctx, key) {
    debug("AddComposition", ctx.composition, key);
    if (this.IsFullComposition(ctx))
      return false;

    const newgroup = this.GetCompositionKeyGroup(ctx, key);
    if (!newgroup || !this.CreateCompositionByGroups(ctx, newgroup, key)) {
      ctx.composition += key;
    }
    this.UpdateComposition(ctx);
    return true;
  }

  DelComposition(ctx) {
    const comp = ctx.composition;
    debug("DelComposition", comp);
    if (!this.HasComposition(ctx))
      return false;
    ctx.composition = comp.replace(/.$/, '');
    this.UpdateComposition(ctx);
    return true;
  }

  CommitText(ctx, candidate_index) {
    debug("CommitText", ctx.candidates, candidate_index);
    candidate_index = candidate_index || 0;
    if (candidate_index >= ctx.candidates.length) {
      warn("CommitText: index out of range", candidate_index, ctx.candidates);
      return false;
    }

    let text = ctx.candidates[candidate_index];
    if (!text) {
      warn("CommitText: invalid text to commit:", text);
      return false;
    }

    this.ResetContext(ctx);
    assert(text != undefined, "CommitText: missing commit text.");
    ctx.commit = text;
    // Compatible with gen_inp.
    ctx.cch = text;
    return true;
  }

  GetSelectionIndex(key) {
    if (this.opts.OPT_SELKEY_SHIFT && key == ' ')
      return 0;
    assert(this.selkey, "GetSelectionIndex: Missing selkey.");
    return this.selkey.indexOf(key);
  }

  IsSelectionKey(ctx, key) {
    return this.GetSelectionIndex(key) >= 0;
  }

  SelectCommit(ctx, key) {
    let keyidx = this.GetSelectionIndex(key);
    assert(keyidx >= 0, "SelectCommit: key should never be out of selkey", key, this.selkey);
    let index = ctx.candidates_start_index + keyidx;
    if (index >= ctx.candidates.length)
      return false;
    debug("SelectCommit: keyidx, index:", keyidx, index);
    return this.CommitText(ctx, index);
  }

  CommitFirst(ctx) {
    if (!this.GetSelKeyLength()) {
      error("CommitFirst: no selkey defined.", ctx);
      return false;
    }
    return this.SelectCommit(ctx, this.selkey[0]);
  }

  ReturnCommitFirst(ctx) {
    if (this.CommitFirst(ctx))
      return this.ResultCommit(ctx);
    return this.ResultError(ctx);
  }

  IsEndKey(ctx, key) {
    debug("IsEndKey", key);
    return this.endkey.includes(key);
  }

  ProcessSpace(ctx, from_convert) {
    // See `docs/cin.txt` for details on SPACE behavior.
    // In AUTO_COMPOSE mode, the candidates window is already there so most
    // modern IM implementations will expect the SPACE to commit.
    // - Array rejected this because of the 'quick' that generates a different set
    //   of candidates, but other IMs all towards auto-commit.
    // - Boshiamy explicitly expects SPACE to always commit even for multiple
    //   pages.
    // - OpenVanilla's behavior (with cusor) is "auto commit only if the
    //   candidates are <= 1 page".
    // Hint: try 'yneu' in Boshiamy to check multi-page candidates behavior.
    //       try '....i' in Array to check single-page acndidates behavior.
    //       try 'w1' in Array to check multi-page candidates behavior.
    let commit = false;

    if (this.opts.OPT_SPACE_FIRST_FULL && this.IsFullComposition(ctx)) {
      // Full composition implies out of %quick so we can ignore checking that.
      commit = true;
      debug("ConvertComposition: SPACE_FIRST_FULL, commit=", commit);
    } else if (from_convert && !this.opts.OPT_AUTO_COMPOSE) {
      // Convert without AUTO_COMPOSE implies we should not do anything special.
      commit = false;
      debug("ConvertComposition: convert without AUTO_COMPOSE, commit=", commit);
    } else if (from_convert && this.override_autocompose) {
      // In convert+override mode, never commit
      commit = false;
      debug("ConvertComposition: override_autocompose, commit=", commit);
    } else if (this.opts.OPT_SPACE_AUTOUP_ANY) {
      commit = true;
      debug("ConvertComposition: SPACE_AUTOUP_ANY, commit=", commit);
    } else if (this.CycleCandidates(ctx)) {
      commit = false;
      debug("ConvertComposition: CycleCandidates, commit=", commit);
    } else if (this.opts.OPT_SPACE_AUTOUP_YES) {
      commit = true;
      debug("ConvertComposition: SPACE_AUTOUP_YES, commit=", commit);
    } else {
      commit = false;
      debug("ConvertComposition: Default (nothing), commit=", commit);
      return this.ResultError(ctx);
    }
    debug('ProcessSpace: commit=', commit, this.opts);

    if (!commit)
      return this.ResultProcessed(ctx);
    return this.ReturnCommitFirst(ctx);
  }

  ConvertComposition(ctx, key) {
    if (!this.HasComposition(ctx))
      return this.ResultIgnore(ctx);
    if (!this.PrepareCandidates(ctx, false)) {
      return this.ResultError(ctx, key);
    }
    this.ShiftState(ctx);

    if (this.IsSingleCandidate(ctx))
      return this.ReturnCommitFirst(ctx);
    if (key == ' ')
      return this.ProcessSpace(ctx, true);

    return this.ResultProcessed(ctx);
  }

  ProcessCompositionStateKey(ctx, ev) {
    const key = normalizeKey(ev.key);

    switch (key) {
      case 'Backspace':
        if (this.DelComposition(ctx))
          return this.ResultProcessed(ctx);
        return this.ResultIgnore(ctx);

      case 'Escape':
        if (this.HasComposition(ctx)) {
          this.ResetContext(ctx);
          return this.ResultProcessed(ctx);
        }
        return this.ResultIgnore(ctx);

      case 'ArrowLeft':
      case 'ArrowUp':
      case 'PageUp':
      case '<':
        if (this.CycleCandidates(ctx, -1)) {
          this.ShiftState(ctx, true);
          return this.ResultProcessed(ctx);
        }
        return this.ResultIgnore(ctx);

      case 'ArrowRight':
      case 'ArrowDown':
      case 'PageDown':
      case '>':
        if (this.CycleCandidates(ctx)) {
          this.ShiftState(ctx, true);
          return this.ResultProcessed(ctx);
        }
        return this.ResultIgnore(ctx);

      default:
        // Some keys may be EndKey, SelectionKey, and CompositionKey at the
        // same time. Here are the rules:
        //  - If the key can make a complete composition, it's either End Key
        //    or Composition key.
        //    * Do convert if the key is End Key.
        //  - If there are candidates available, treat it as selection key.
        //  - Otherwise, assume it's composition key.
        //  Examples:
        //   - Phonetic: end=sel=compose for 3467. Endkey is always at last.
        //   - Array30/GCIN: [0-9] are end/sel/comp.
        //     * L1/L2 quick: as selection keys.
        //     * W[0-9]: as endkey.
        //   - Array30/XCIN25: [0-9] are sel.
        //     * W[0-9]: must be also considered as composition / end key.
        //  In XCIN GenInp, the opt END_KEY controls the behavior but that we
        //  actually need this option to make the composition correct than a
        //  preference. As a result, GenInp2 will ignore that option and only
        //  check if %endkey is set.

        if (this.CanDoComposition(ctx, key)) {
          if (this.IsEndKey(ctx, key)) {
            this.AddComposition(ctx, key);
            return this.ConvertComposition(ctx, key);
          }
        } else {
          if (this.IsSelectionKey(ctx, key) && this.HasCandidates(ctx)) {
            if (this.SelectCommit(ctx, key))
              return this.ResultCommit(ctx);
            return this.ResultError(ctx, key);
          }
        }

        if (this.IsCompositionKey(ctx, key) || this.CanDoComposition(ctx, key)) {
          if (!this.AddComposition(ctx, key))
            return this.ResultError(ctx, key);

          if (this.opts.OPT_COMMIT_ON_FULL && this.IsFullComposition(ctx))
            return this.ConvertComposition(ctx, key);

          if (this.opts.OPT_UNIQUE_AUTO && this.IsUniqueCandidate(ctx))
            return this.ConvertComposition(ctx, key);

          // Implicit endkeys (Array30/XCIN25 W[0-9])
          if (!this.IsCompositionKey(ctx, key))
            return this.ConvertComposition(ctx, key);

          return this.ResultProcessed(ctx);
        }

        if (key == ' ')
          return this.ConvertComposition(ctx, key);
        break;
    }
    return this.ResultIgnore(ctx);
  }

  ProcessCandidatesStateKey(ctx, ev) {
    const key = normalizeKey(ev.key);

    switch (key) {
      case 'Escape':
        this.ResetContext(ctx);
        return this.ResultProcessed(ctx);

      case 'Backspace':
        this.ShiftState(ctx);
        this.DelComposition(ctx);
        return this.ResultProcessed(ctx);

      case 'ArrowLeft':
      case 'ArrowUp':
      case 'PageUp':
      case '<':
        if (this.CycleCandidates(ctx, -1))
          return this.ResultProcessed(ctx);
        return this.ResultIgnore(ctx);

      case 'ArrowRight':
      case 'ArrowDown':
      case 'PageDown':
      case '>':
        if (this.CycleCandidates(ctx))
          return this.ResultProcessed(ctx);
        return this.ResultIgnore(ctx);

      default:
        if (this.IsSelectionKey(ctx, key)) {
          if (this.SelectCommit(ctx, key))
            return this.ResultCommit(ctx);
          return this.ResultError(ctx, key);
        }
        // AUTO_UPCHAR: From definition, we should commit + keep typing any
        // characters; however currently we can't do ResultCommit+ResultIgnore
        // at the same time, so we can only commit on Composition keys.
        if (key == ' ') {
          assert(this.HasCandidates(ctx), "SPACE in STATE_CANDIDATES needs candidates");
          return this.ProcessSpace(ctx, false);
        } else if (!this.IsCompositionKey(ctx, key)) {
          return this.ResultIgnore(ctx);
        } else if (this.opts.OPT_AUTO_UPCHAR && this.CommitFirst(ctx)) {
          this.AddComposition(ctx, key);
          return this.ResultCommit(ctx);
        }
        return this.ResultError(ctx);
    }
  }

  ProcessKeystroke(ctx, ev) {
    debug("ProcessKeystroke", ev);
    if (ev.type != 'keydown' || hasCtrlAltMeta(ev)) {
      return this.ResultIgnore(ctx);
    }

    switch (ctx.state) {
      case this.STATE_COMPOSITION:
        return this.ProcessCompositionStateKey(ctx, ev);
      case this.STATE_CANDIDATES:
        return this.ProcessCandidatesStateKey(ctx, ev);
    }
    return this.ResultIgnore(ctx);
  };
}

jscin.registerModule(GenInp2);
