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
const {log, debug, info, warn, error, assert, trace} = AddLogger("gen_inp2");

export class GenInp2 extends BaseInputMethod
{
  constructor(name, conf)
  {
    super(name, conf);
    // Declaration of states
    this.STATE_COMPOSITION = 1;
    this.STATE_CANDIDATES = 2;

    this.MAX_MATCH_PAGES = 10; // eeach page has self.selkey.length candidates
    this.GLOB_KEYS = '?*';

    // Read and parse from conf (a standard parsed CIN).
    this.table = conf.chardef || {};
    this.trie = undefined; // trie is created only if we need frequent partial match.
    this.max_composition = parseInt(conf.max_keystroke || "0");
    this.opts = {
      OPT_AUTO_COMPOSE: true,
      OPT_AUTO_UPCHAR: true,
      OPT_SPACE_RESET: true,
      OPT_WILD_ENABLE: true,
    };

    // The table to override when converting composition to candidates.
    this.override_conversion = conf.KEYSTROKE_REMAP;
    // The table to override when composition is not explicitly converted.
    this.override_autocompose = conf.quick;
    this.keygroups = conf.KEYGROUPS;

    // Convert table commands to options.
    let opts_remap = {
      SPACE_AUTOUP: 'OPT_SPACE_AUTOUP',
      SPACE_RESET: 'OPT_SPACE_RESET',
      AUTO_COMPOSE: 'OPT_AUTO_COMPOSE',
      AUTO_FULLUP: 'OPT_COMMIT_ON_FULL',
      AUTO_RESET: 'OPT_AUTO_RESET',
      AUTO_UPCHAR: 'OPT_AUTO_UPCHAR',
      END_KEY: 'OPT_END_KEY',
      WILD_ENABLE: 'OPT_WILD_ENABLE',
      flag_unique_auto_send: 'OPT_UNIQUE_AUTO',
      flag_disp_partial_match: 'OPT_PARTIAL_MATCH',
    };

    for (let key in opts_remap) {
      if (key in conf)
        this.opts[opts_remap[key]] = conf[key];
    }

    // Currently CIN stores most tables as simple strings.
    this._NormalizeTable(this.override_conversion);
    this._NormalizeTable(this.override_autocompose);
  }

  _NormalizeTable(t) {
    if (!t)
      return t;
    for (let k in t) {
      let v = t[k];
      if (typeof(v) == 'string')
        t[k] = v.split('');
    }
    return t;
  }

  reset_context(ctx)
  {
    super.reset_context(ctx);
    ctx.state = this.STATE_COMPOSITION;
    ctx.composition = '';
    ctx.candidates = [];
    ctx.commit = '';
    ctx.display_composition = '';
    ctx.candidates_start_index = 0;
    ctx.page_prompt = '';

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
    error('BEEP');
    // beep.
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
    return jscin.IMKEY_ABSORB;
  }

  ResultIgnored(ctx) {
    return jscin.IMKEY_IGNORE;
  }

  ResultCommit(ctx) {
    return jscin.IMKEY_COMMIT;
  }

  GetMatchLimit(pages) {
    if (!pages)
      pages = this.MAX_MATCH_PAGES;
    return pages * this.selkey.length;
  }

  Glob2Regex(pattern) {
    // assert GLOB_KEYS == '*?'.
    return new RegExp("^" + pattern
      .replace(new RegExp('([\\][\\\\./^$()!|{}+-])', "g"), "\\$1")
      .replace(/\?/g, ".").replace(/\*/g, ".*")
      + "$");
  }

  IsGlobPattern(pattern) {
    for (let k of this.GLOB_KEYS)
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
    const i = ctx.candidates_start_index;
    const pageSize = this.selkey.length;
    const c = ctx.candidates;
    let total = Math.ceil(c.length / pageSize);
    let now = Math.ceil((i + 1) / pageSize);

    ctx.mcch = c.slice(i, i + pageSize);
    ctx.page_prompt = (total > 1) ? `${now}/${total}` : '';
  }

  UpdateComposition(ctx) {
    debug("UpdateComposition", ctx.composition);
    ctx.display_composition = ctx.composition.split('').map(
      (c) => this.keyname[c] || c).join('');
    // Compatible with gen_inp.
    ctx.keystroke = ctx.display_composition;

    this.PrepareCandidates(ctx, true);
  }

  ShiftState(ctx) {
    debug("ShiftState", ctx.state);
    switch (ctx.state) {
      case this.STATE_COMPOSITION:
        ctx.state = this.STATE_CANDIDATES;
        ctx.candidates_start_index = 0;
        break;
      case this.STATE_CANDIDATES:
        ctx.state = this.STATE_COMPOSITION;
        ctx.candidates_start_index = 0;
        break;
    }
  }

  AddCandidates(ctx, list) {
    if (!list || !list.length)
      return false;
    ctx.candidates = ctx.candidates.concat(list);
    return true;
  }

  IsSingleCandidate(ctx) {
    return ctx.candidates.length == 1;
  }

  IsUniqueCandidate(ctx) {
    // Checks if there is only 1 candidate (by partial match).
    let r = this.GetPartialMatchCandidates(ctx);
    debug("IsUniqueCandidate:", r);
    return (r.length == 1);
  }

  CanCycleCandidates(ctx) {
    return ctx.candidates.length > this.selkey.length;
  }

  CycleCandidates(ctx, direction) {
    let start = ctx.candidates_start_index;
    debug("CycleCandidates", ctx.candidates, start, direction);
    if (!this.CanCycleCandidates(ctx))
      return false;
    direction = direction || 1;
    let max = ctx.candidates.length;
    let cycle_size = this.selkey.length;
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

  BuildTrie(table) {
    let trie = new Trie();
    if (!table)
      table = this.table;
    for (const [k, v] of Object.entries(table))
      trie.add(k, v);
    return trie;
  }

  TriePartialMatch(ctx, prefix, trie, limit) {
    if (!trie)
      trie = this.trie;
    if (!limit)
      limit = this.GetMatchLimit();
    let node = trie.find(prefix);
    if (!node)
      return [];
    let r = node.below(limit).flat();
    debug("Trie partial match:", prefix, node, r);
    return r;
  }

  GetPartialMatchCandidates(ctx, prefix, table, limit) {
    if (!prefix)
      prefix = ctx.composition;
    if (!prefix) {
      warn("GetPartialMatchCandidates: prefix is empty, abort");
      return [];
    }
    if (this.opts.OPT_PARTIAL_MATCH || this.opts.OPT_UNIQUE_AUTO) {
      // We can't afford to create trie on every new table, so let's assume the
      // table is exactly this.table.
      if (!this.trie)
        this.trie = this.BuildTrie(this.table);
      return this.TriePartialMatch(ctx, prefix, this.trie, limit);
    }
    return this._MatchCandidates(ctx, (k) => {
      return k.startsWith(prefix);
    }, table, limit);
  }

  GlobCandidates(ctx, pattern, table, limit) {
    let regex = this.Glob2Regex(pattern || ctx.composition);

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
    for (let k of Object.keys(table)) {
      if (!matcher(k))
        continue;
      result = result.concat(table[k]);
      if (result.length >= limit) {
        debug("MatchCandidates: too many candidates:", result.length, result);
        break;
      }
    }
    return result;
  }

  PrepareCandidates(ctx, autocompose_stage) {
    debug("PrepareCandidates", ctx.composition, "autocompose_stage:", autocompose_stage);
    let table = this.table;
    let key = ctx.composition;
    let override = undefined;
    let changed = false;
    let limit = this.GetMatchLimit(autocompose_stage ? 1 : undefined);

    this.ClearCandidates(ctx);

    if (!key) {
      // calling this.UpdateCandidates(ctx) was required, but today we always
      // modified the states in ClearCandidates.
      return false;
    }

    // Process override_* tables.
    if (autocompose_stage) {
      override = this.override_autocompose;
      if (!override && !this.opts.OPT_AUTO_COMPOSE)
        table = {};
    } else { // converted (candidates) stage.
      override = this.override_conversion;
    }
    if (override && override[key]) {
      table = override;
      changed = true;
    }

    if (this.opts.OPT_WILD_ENABLE && this.IsGlobPattern(key)) {
      this.AddCandidates(ctx, this.GlobCandidates(ctx, key, table, limit));
      debug("PrepareCandidates: - glob", ctx.candidates);
    } else if (!changed && autocompose_stage && this.opts.OPT_PARTIAL_MATCH) {
      this.AddCandidates(ctx, this.GetPartialMatchCandidates(ctx, key, table, limit));
      debug("PrepareCandidates: - partial", ctx.candidates);
    } else {
      this.AddCandidates(ctx, table[key]);
      debug("PrepareCandidates: - exact match", ctx.candidates);
    }

    this.UpdateCandidates(ctx);
    return ctx.candidates.length > 0;
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

  IsEmptyComposition(ctx) {
    return ctx.composition.length == 0;
  }

  IsFullComposition(ctx) {
    return (this.max_composition &&
      ctx.composition.length >= this.max_composition);
  }

  IsEmptyCandidates(ctx) {
    return ctx.candidates.length == 0;
  }

  GetCompositionKeyGroup(ctx, key) {
    let groups = this.keygroups;
    if (!groups)
      return undefined;
    for (let g in groups) {
      if (groups[g].includes(key))
        return g;
    }
    return undefined;
  }

  CreateCompositionByGroups(ctx, newgroup, key) {
    debug("CreateCompositionByGroups: new_grouop", newgroup);
    // modify composition to fit key groups.
    let key_by_group = {};
    for (let c of ctx.composition) {
      let cg = this.GetCompositionKeyGroup(ctx, c);
      // If any composition is not grouped, abort.
      if (!cg)
        return false;
      key_by_group[cg] = c;
    }
    debug("CreateCompositionByGroups key_by_group", key_by_group, newgroup, key);
    key_by_group[newgroup] = key;
    let v = '';
    for (let g of Object.keys(key_by_group).sort()) {
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

    let newgroup = this.GetCompositionKeyGroup(ctx, key);
    if (!newgroup || !this.CreateCompositionByGroups(ctx, newgroup, key)) {
      ctx.composition += key;
    }
    this.UpdateComposition(ctx);
    return true;
  }

  DelComposition(ctx) {
    let comp = ctx.composition;
    debug("DelComposition", comp);
    if (!comp.length)
      return false;
    ctx.composition = comp.replace(/.$/, '');
    this.UpdateComposition(ctx);
    return true;
  }

  CommitText(ctx, candidate_index) {
    debug("CommitText", ctx.candidates, candidate_index);
    candidate_index = candidate_index || 0;
    if (candidate_index >= ctx.candidates.length)
      return false;

    let text = ctx.candidates[candidate_index];
    this.ResetContext(ctx);
    assert(text != undefined, "CommitText: missing commit text.");
    ctx.commit = text;
    // Compatible with gen_inp.
    ctx.cch = text;
    return true;
  }

  IsSelectionKey(ctx, key) {
    return this.selkey.includes(key);
  }

  IsEndKey(ctx, key) {
    debug("IsEndKey", key);
    return this.endkey.includes(key);
  }

  SelectCommit(ctx, key) {
    let keyidx = this.selkey.indexOf(key);
    assert(keyidx >= 0, "SelectCommit: key should never be out of selkey", key, this.selkey);
    let index = ctx.candidates_start_index + keyidx;
    if (index >= ctx.candidates.length)
      return false;
    debug("SelectCommit: keyidx, index:", keyidx, index);
    return this.CommitText(ctx, index);
  }

  ConvertComposition(ctx, key) {
    if (this.IsEmptyComposition(ctx))
      return this.ResultIgnored(ctx);
    if (!this.PrepareCandidates(ctx, false)) {
      return this.ResultError(ctx, key);
    }
    this.ShiftState(ctx);

    // In AUTO_COMPOSE mode, the candidates window is already there so most
    // modern IM implementations will expect the SPACE to commit. Array
    // rejected this because of the 'quick' that generates a different set of
    // candidates, but other IMs all towards auto-commit. Boshiamy is more
    // explicit on SPACE to commit because it has almost no chance to show
    // candidates more than one page, but the partial match and glob would
    // change it. OpenVanilla proposed the solution of "auto commit only if
    // the candidates are <= 1 page", which is a good solution so we'll follow
    // here.
    // As a result, the implementation for SPACE here is:
    //  - If override_autocompose, don't commit.
    //  - If CanCycleCandidates, don't commit.
    //  - Otherwise, commit.
    let commit = this.IsSingleCandidate(ctx);

    if (!commit && key == ' ' && this.opts.OPT_AUTO_COMPOSE &&
      !this.override_autocompose && this.opts.OPT_AUTO_UPCHAR) {

      if (!this.CycleCandidates(ctx))
        commit = true;
    }
    debug('ConvertComposition', `[${key}]`, commit, this.opts);

    if (commit) {
      this.CommitText(ctx, 0);
      return this.ResultCommit(ctx);
    }
    return this.ResultProcessed(ctx);
  }

  ProcessCompositionStateKey(ctx, ev) {
    let key = normalizeKey(ev.key);

    switch (key) {
      case 'Backspace':
        if (!this.DelComposition(ctx))
          return this.ResultIgnored(ctx);
        return this.ResultProcessed(ctx);

      case 'Escape':
        if (this.IsEmptyComposition(ctx))
          return this.ResultIgnored(ctx);
        this.ResetContext(ctx);
        return this.ResultProcessed(ctx);

      case ' ':
        return this.ConvertComposition(ctx, key);

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

        if (this.opts.OPT_END_KEY && this.IsEndKey(ctx, key)) {
            this.AddComposition(ctx, key);
            return this.ConvertComposition(ctx, key);
        }
        if (this.CanDoComposition(ctx, key)) {
          if (this.IsEndKey(ctx, key)) {
            this.AddComposition(ctx, key);
            return this.ConvertComposition(ctx, key);
          }
        } else {
          if (this.IsSelectionKey(ctx, key) && !this.IsEmptyCandidates(ctx)) {
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
    }
    return this.ResultIgnored(ctx);
  }

  ProcessCandidatesStateKey(ctx, ev) {
    let key = normalizeKey(ev.key);

    switch (key) {
      case 'Escape':
        this.ResetContext(ctx);
        return this.ResultProcessed(ctx);

      case 'Backspace':
        this.ShiftState(ctx);
        this.DelComposition(ctx);
        return this.ResultProcessed(ctx);

      case 'ArrowLeft':
      case 'PageUp':
      case 'ArrowUp':
        this.CycleCandidates(ctx, -1);
        return this.ResultProcessed(ctx);

      case 'ArrowRight':
      case 'PageDown':
      case 'ArrowDown':
        this.CycleCandidates(ctx);
        return this.ResultProcessed(ctx);

      case ' ':
        if (this.CycleCandidates(ctx))
          return this.ResultProcessed(ctx);
        if (this.opts.OPT_AUTO_UPCHAR && this.opts.OPT_SPACE_AUTOUP) {
          this.CommitText(ctx, 0);
          return this.ResultCommit(ctx);
        }
        return this.ResultProcessed(ctx);

      default:
        if (this.IsSelectionKey(ctx, key)) {
          if (this.SelectCommit(ctx, key))
            return this.ResultCommit(ctx);
          return this.ResultError(ctx, key);
        }
        // From definition, we should commit + keep typing any characters;
        // however, currently we can't do ResultCommit+ResultIgnore at the same
        // time, so we can only commit on Composition keys.
        if (this.opts.OPT_AUTO_UPCHAR) {
          if (this.IsCompositionKey(ctx, key)) {
            this.CommitText(ctx, 0);
            this.AddComposition(ctx, key);
            return this.ResultCommit(ctx);
          }
        }
        if (this.IsCompositionKey(key, key))
          return this.ResultError(ctx);
        return this.ResultIgnored(ctx);
    }
  }

  ProcessKeystroke(ctx, ev) {
    debug("ProcessKeystroke", ev);
    if (ev.type != 'keydown' || hasCtrlAltMeta(ev)) {
      return this.ResultIgnored(ctx);
    }

    switch (ctx.state) {
      case this.STATE_COMPOSITION:
        return this.ProcessCompositionStateKey(ctx, ev);
      case this.STATE_CANDIDATES:
        return this.ProcessCandidatesStateKey(ctx, ev);
    }
    return this.ResultIgnored(ctx);
  };
}

jscin.registerModule(GenInp2);
