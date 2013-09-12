// Copyright 2013 Google Inc. All Rights Reserved.

/**
 * @fileoverview General Input Method Module, Version 2 (from scratch).
 * @author hungte@google.com (Hung-Te Lin)
 */

// TODO(hungte) SPACE_RESET (reset on error).

GenInp2 = function(name, conf) {
  var self = this;
  self.name = name;

  if (!conf)
    conf = jscin.getTableData(name);

  if (!conf) {
    trace('failed to load ', name);
    return;
  }
  trace('GenInp2: conf loaded');

  // Declaration of states
  self.STATE_COMPOSITION = 1;
  self.STATE_CANDIDATES = 2;

  // Read and parse from conf (a standard parsed CIN).
  self.cname = conf.cname || name;
  self.ename = conf.ename || name;
  self.keyname = conf.keyname || [];  // upper-cased.
  self.table = conf.chardef || {}; // upper-cased.
  self.selkey = conf.selkey || []; // probably also upper-cased.
  self.max_composition = parseInt(conf.max_keystroke || "0");
  self.endkey = conf.endkey || "";
  self.opts = {};

  // jscin gen_input v1
  if (conf.SELKEY_SHIFT) {
    self.opts.OPT_SELKEY_SHIFT = true;
  }

  if (conf.AUTO_FULLUP) {
    self.opts.OPT_COMMIT_ON_FULL = true;
  }

  if (conf.KEYGROUPS) {
    self.keygroups = conf.KEYGROUPS;
  }

  if (conf.KEYSTROKE_REMAP) {
    self.override_table = conf.KEYSTROKE_REMAP;
  }

  if (conf.quickkey) {
    self.override_table = conf.quickkey;
  }

  // gcin
  switch (parseInt(conf.space_style || "-1")) {
    case 1:
      // Boshiamy, Dayi
      self.opts.OPT_SELKEY_SHIFT = true;
      break;

    case 2:
      // Simplex.
      self.opts.OPT_COMMIT_ON_FULL = true;
      break;

    case 4:
      // Windows Array30, Changjei.
      break;

    case 8:
      // Dayi: input:2, select:1 (?)
      self.opts.OPT_SPACE_COMMIT_DAYI = true;
      break;

    case -1:
      break;

    default:
      trace("unknown space_style: ", conf.space_style);
      break;
  }

  var flag = parseInt(conf.flag || "0");
  if (flag & 0x80) {  // FLAG_GTAB_PRESS_FULL_AUTO_SEND
    self.opts.OPT_COMMIT_ON_FULL = true;
  }
  if (flag & 0x100) { // FLAG_GTAB_UNIQUE_AUTO_SEND
    // Only seen on greek.cin
    self.opts.OPT_COMMIT_ON_SINGLE_CANDIDATE = true;
  }

  // Adjust any context data.
  if (self.opts.OPT_SELKEY_SHIFT) {
    self.selkey = ' ' + self.selkey;
  }
}

GenInp2.prototype.new_instance = function(ctx) {
  var self = new Object();
  var conf = this;

  // Initialize context.
  ResetContext(ctx);

  function ResultError(ctx) {
    NotifyError(ctx);
    return jscin.IMKEY_ABSORB;
  }

  function ResultProcessed(ctx) {
    return jscin.IMKEY_ABSORB;
  }

  function ResultIgnored(ctx) {
    return jscin.IMKEY_IGNORE;
  }

  function ResultCommit(ctx) {
    return jscin.IMKEY_COMMIT;
  }

  function ResetContext(ctx) {
    trace(ctx);
    ctx.state = conf.STATE_COMPOSITION;
    ctx.composition = '';
    ctx.candidates = [];
    ctx.commit = '';
    ctx.display_composition = '';
    ctx.candidates_start_index = 0;

    // Compatible with gen_inp.
    ctx.selkey = conf.selkey;
    ctx.keystroke = '';
    ctx.mcch = '';
    ctx.cch = '';
  }

  function UpdateCandidates(ctx) {
    trace(ctx);
    // Compatible with gen_inp.
    ctx.mcch = ctx.candidates.substr(
        ctx.candidates_start_index, conf.selkey.length);
  }

  function UpdateComposition(ctx) {
    trace(ctx.composition);
    ctx.display_composition = '';
    for (var i = 0; i < ctx.composition.length; i++) {
      var c = ctx.composition[i].toUpperCase()
      ctx.display_composition += conf.keyname[c] || c;
    }
    // Compatible with gen_inp.
    ctx.keystroke = ctx.display_composition;
  }

  function ShiftState(ctx) {
    trace(ctx.state);
    switch (ctx.state) {
      case conf.STATE_COMPOSITION:
        ctx.state = conf.STATE_CANDIDATES;
        ctx.candidates_start_index = 0;
        break;
      case conf.STATE_CANDIDATES:
        ctx.state = conf.STATE_COMPOSITION;
        ctx.candidates_start_index = 0;
        break;
    }
  }

  function IsSingleCandidate(ctx) {
    return ctx.candidates.length == 1;
  }

  function CanCycleCandidates(ctx) {
    return ctx.candidates.length > conf.selkey.length;
  }

  function CycleCandidates(ctx, direction) {
    trace(ctx, direction);
    if (!CanCycleCandidates(ctx))
      return false;
    direction = direction || 1;
    var max = ctx.candidates.length;
    var cycle_size = conf.selkey.length;
    var new_index = ctx.candidates_start_index + direction * cycle_size;
    if (new_index >= max) {
      new_index = 0;
    } else if (new_index < 0) {
      new_index = max - (max % cycle_size);
    }
    trace('old index: ' + ctx.candidates_start_index +
          ", new index: " + new_index);
    ctx.candidates_start_index = new_index;
    UpdateCandidates(ctx);
    return true;
  }

  function PrepareCandidates(ctx, allow_override) {
    trace(ctx.composition);
    var table = conf.table;
    var key = ctx.composition.toUpperCase();
    // TODO(hungte) Currently cin_parser concats everything into a big string,
    // so candidates is a string. We should make it into an array.
    if (allow_override && conf.override_table && conf.override_table[key])
      table = conf.override_table;
    ctx.candidates = table[key] || '';
    UpdateCandidates(ctx);
    return ctx.candidates.length > 0;
  }

  function IsCompositionKey(ctx, key) {
    return key.toUpperCase() in conf.keyname;
  }

  function CanDoComposition(ctx, key) {
    // Some CIN tables like Array30 may include special keys (ex, selection
    // keys) as part of composition.
    if (conf.table[(ctx.composition + key).toUpperCase()])
      return true;
    return false;
  }

  function IsEmptyComposition(ctx) {
    return ctx.composition.length == 0;
  }

  function IsFullComposition(ctx) {
    return (conf.max_composition &&
            ctx.composition.length >= conf.max_composition);
  }

  function IsEmptyCandidates(ctx) {
    return ctx.candidates.length == 0;
  }

  function GetCompositionKeyGroup(ctx, key) {
    if (!conf.keygroups)
      return undefined;
    for (var g in conf.keygroups) {
      if (conf.keygroups[g].toUpperCase().indexOf(key.toUpperCase()) >= 0)
        return g;
    }
    return undefined;
  }

  function CreateCompositionByGroups(ctx, newgroup, key) {
    trace("new_grouop", newgroup);
    // modify composition to fit key groups.
    var key_by_group = {};
    for (var i = 0; i < ctx.composition.length; i++) {
      var c = ctx.composition[i];
      var cg = GetCompositionKeyGroup(ctx, c);
      // If any composition is not grouped, abort.
      if (!cg)
        return false;
      key_by_group[cg] = c;
    }
    trace("key_by_group", key_by_group);
    key_by_group[newgroup] = key;
    trace("key_by_group, key updated", key_by_group);
    ctx.composition = '';
    Object.keys(key_by_group).sort().forEach(function (g) {
      ctx.composition += key_by_group[g];
    });
    return true;
    // TODO(hungte) Make an index for DelComposition to delete last entered key,
    // or only update the displayed composition.
  }

  function AddComposition(ctx, key) {
    trace(ctx, key);
    if (IsFullComposition(ctx))
      return false;

    var newgroup = GetCompositionKeyGroup(ctx, key);
    if (!newgroup || !CreateCompositionByGroups(ctx, newgroup, key)) {
      ctx.composition += key;
    }
    UpdateComposition(ctx);
    PrepareCandidates(ctx);
    return true;
  }

  function DelComposition(ctx) {
    trace(ctx);
    if (!ctx.composition.length)
      return false;
    ctx.composition = ctx.composition.replace(/.$/, '');
    UpdateComposition(ctx);
    PrepareCandidates(ctx);
    UpdateCandidates(ctx);
    return true;
  }

  function CommitText(ctx, candidate_index) {
    trace(ctx.candidates, candidate_index);
    candidate_index = candidate_index || 0;
    if (ctx.candidates.length < candidate_index)
      return false;

    var text = ctx.candidates[candidate_index];
    ResetContext(ctx);
    ctx.commit = text;
    trace('COMMIT=', ctx.commit);
    // Compatible with gen_inp.
    ctx.cch = text;
    return true;
  }

  function IsSelectionKey(ctx, key) {
    return conf.selkey.indexOf(key.toUpperCase()) >= 0;
  }

  function IsEndKey(ctx, key) {
    return conf.endkey && conf.endkey.indexOf(key.toUpperCase()) >= 0;
  }

  function SelectCommit(ctx, key) {
    trace(ctx, key);
    var index = (ctx.candidates_start_index +
                 conf.selkey.indexOf(key.toUpperCase()));
    return CommitText(ctx, index);
  }

  function ConvertComposition(ctx) {
    if (IsEmptyComposition(ctx))
      return ResultIgnored(ctx);
    if (!PrepareCandidates(ctx, true)) {
      return ResultError(ctx);
    }
    ShiftState(ctx);
    if (IsSingleCandidate(ctx) || conf.opts.OPT_SELKEY_SHIFT) {
      CommitText(ctx, 0);
      return ResultCommit(ctx);
    }
    return ResultProcessed(ctx);
  }

  function NotifyError(ctx) {
    trace('BEEP');
    // beep.
  }

  function ProcessCompositionStateKey(ctx, ev) {
    var key = ev.key;

    switch (key) {
      case 'Backspace':
        if (!DelComposition(ctx))
          return ResultIgnored(ctx);
        return ResultProcessed(ctx);

      case 'Esc':
        if (IsEmptyComposition(ctx))
          return ResultIgnored(ctx);
        ResetContext(ctx);
        return ResultProcessed(ctx);

      case ' ':
        return ConvertComposition(ctx);

      default:
        // When shift+selection key, always treat it like "selection".
        if (!ev.shiftKey) {
          if (IsEndKey(ctx, key)) {
            trace('IsEndKey', key);
            if (IsEmptyComposition(ctx))
              return ResultIgnored(ctx);
            AddComposition(ctx, key);
            return ConvertComposition(ctx);
          }

          if (IsCompositionKey(ctx, key) || CanDoComposition(ctx, key)) {
            if (AddComposition(ctx, key)) {
              if (conf.opts.OPT_COMMIT_ON_FULL && IsFullComposition(ctx)) {
                return ConvertComposition(ctx);
              }
              if (conf.opts.OPT_COMMIT_ON_SINGLE_CANDIDATE &&
                  IsSingleCandidate(ctx)) {
                return ConvertComposition(ctx);
              }
              // See CanDoComposition for more information.
              if (!IsCompositionKey(ctx, key))
                return ConvertComposition(ctx);
              return ResultProcessed(ctx);
            }
            return ResultError(ctx);
          }
        }

        if (IsSelectionKey(ctx, key) && !IsEmptyCandidates(ctx)) {
          if (SelectCommit(ctx, key))
            return ResultCommit(ctx);
          return ResultError(ctx);
        }
        break;
    }
    return ResultIgnored(ctx);
  }

  function ProcessCandidatesStateKey(ctx, ev) {
    var key = ev.key;
    if (ev.shiftKey) {
      switch (key) {
        case ',':
          key = '<';
          break;
        case '.':
          key = '>';
          break;
        default:
          if (!IsSelectionKey(ctx, key))
            return ResultIgnored(ctx);
          break;
      }
    }
    switch (key) {
      case 'Esc':
        ResetContext(ctx);
        return ResultProcessed(ctx);

      case 'Backspace':
        ShiftState(ctx);
        DelComposition(ctx);
        return ResultProcessed(ctx);

      case 'Left':
      case 'PageUp':
      case 'Up':
      case '<':
        CycleCandidates(ctx, -1);
        return ResultProcessed(ctx);

      case 'Right':
      case 'PageDown':
      case 'Down':
      case '>':
        CycleCandidates(ctx);
        return ResultProcessed(ctx);

      case ' ':
        if (!CycleCandidates(ctx)) {
          CommitText(ctx, 0);
          return ResultCommit(ctx);
        }
        return ResultProcessed(ctx);

      default:
        if (IsSelectionKey(ctx, key)) {
          if (SelectCommit(ctx, key))
            return ResultCommit(ctx);
          return ResultError(ctx);
        }
        if (IsCompositionKey(ctx, key)) {
          CommitText(ctx, 0);
          AddComposition(ctx, key);
          return ResultCommit(ctx);
        }
        break;
    }
  }

  self.onKeystroke = function(ctx, ev) {
    trace(ev);
    if (ev.type != 'keydown' || ev.ctrlKey || ev.altKey)
      return ResultIgnored(ctx);

    switch (ctx.state) {
      case conf.STATE_COMPOSITION:
        return ProcessCompositionStateKey(ctx, ev);
      case conf.STATE_CANDIDATES:
        return ProcessCandidatesStateKey(ctx, ev);
    }
    return ResultIgnored(ctx);
  }

  // ------------------------------------------------
  return self;
}

// Entry stub
jscin.register_module('GenInp', GenInp2);
jscin.debug = true;

