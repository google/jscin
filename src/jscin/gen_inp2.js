// Copyright 2013 Google Inc. All Rights Reserved.

/**
 * @fileoverview General Input Method Module, Version 2 (from scratch).
 * @author hungte@google.com (Hung-Te Lin)
 */

// TODO(hungte) SPACE_RESET (reset on error).
// TODO(hungte) Indicators for candidates to show "composition state" or
// "selection only state".
// TODO(hungte) Allow enabling glob or not, and to allow glob keys properly.

jscin.register_module('GenInp2', jscin.extend_input_method({

  constructor: function (name, conf)
  {
    var self = this;

    // Declaration of states
    self.STATE_COMPOSITION = 1;
    self.STATE_CANDIDATES = 2;

    self.MAX_GLOB_PAGES = 50;
    self.GLOB_KEYS = '?*';

    // Read and parse from conf (a standard parsed CIN).
    self.table = conf.chardef || {}; // upper-cased.
    self.max_composition = parseInt(conf.max_keystroke || "0");
    self.opts = {
      OPT_AUTO_COMPOSE: true
    };
    // The table to override when converting composition to candidates.
    self.override_conversion = undefined;
    // The table to override when composition is not explicitly converted.
    self.override_autocompose = undefined;

    // Adjust options (implicitly) by table content.

    var key;

    for (var i = 0, len = self.selkey.length; i < len; i++) {
      var k = self.selkey[i];
      if (k in self.keyname || self.endkey.indexOf(k) >= 0)
        self.opts.OPT_AUTO_COMPOSE = false;
    }

    // Adjust options (explicitly) by table commands.

    var opts_remap = {
      SELKEY_SHIFT: 'OPT_SELKEY_SHIFT',
      SPACE_AUTOUP: 'OPT_SPACE_AUTOUP',
      AUTO_COMPOSE: 'OPT_AUTO_COMPOSE',
      AUTO_FULLUP: 'OPT_COMMIT_ON_FULL'
    };

    var conf_remap = {
      KEYGROUPS: 'keygroups',
      KEYSTROKE_REMAP: 'override_conversion',

      // quickkey is found on XCIN2.3 (and deprecated in XCIN 2.5).
      quickkey: 'override_autocompose',
      // quick is supported by GCIN.
      quick: 'override_autocompose',
    };

    for (key in opts_remap) {
      if (key in conf) {
        self.opts[opts_remap[key]] = conf[key];
      }
    }

    for (key in conf_remap) {
      if (key in conf) {
        self[conf_remap[key]] = conf[key];
      }
    }

    // gcin
    switch (parseInt(conf.space_style || "-1")) {
      case 1:
        // Boshiamy
        self.opts.OPT_SELKEY_SHIFT = true;
        self.opts.OPT_SPACE_AUTOUP = true;
        break;

      case 2:
        // Simplex.
        self.opts.OPT_COMMIT_ON_FULL = true;
        break;

      case 4:
        // Windows Array30, Changjei.
        break;

      case 8:
        // Dayi.
        self.opts.OPT_SELKEY_SHIFT = true;
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
  },

  reset_context: function (ctx)
  {
    var self = this;
    self.super.reset_context.call(self, ctx);
    ctx.state = self.STATE_COMPOSITION;
    ctx.composition = '';
    ctx.candidates = '';
    ctx.commit = '';
    ctx.display_composition = '';
    ctx.candidates_start_index = 0;

    // Flag for addons.
    ctx.auto_compose = (
        self.opts.OPT_AUTO_COMPOSE || self.override_autocompose) ? true : false;
  },

  init: function (ctx)
  {
    this.super.init.call(this, ctx);
    var self = this;

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

    function Glob2Regex(pattern) {
      return new RegExp("^" + pattern
          .replace(new RegExp('([\\][\\\\\./^$()!|{}+-])', "g"), "\\$1")
          .replace(/\?/g, ".").replace(/\*/g, ".*")
          + "$");
    }

    function IsGlobInPattern(pattern) {
      return (pattern.indexOf('?') >= 0 ||
              pattern.indexOf('*') >= 0);
    }

    function IsGlobKey(key) {
      // TODO(hungte) Add an option to turn on/off.
      return self.GLOB_KEYS.indexOf(key) >= 0;
    }

    function GlobFromArray(pattern, array, callback) {
      // Terminates when callback returns true.
      trace(pattern);
      var regex = Glob2Regex(pattern);
      // Currently looping with index is the fastest way to iterate an array.
      for (var i = 0, len = array.length; i < len; i++) {
        if (regex.test(array[i]) && callback(array[i]))
          break;
      }
    }

    function ResetContext(ctx) {
      return self.reset_context(ctx);
    }

    function ClearCandidates(ctx) {
      ctx.candidates = '';
    }

    function UpdateCandidates(ctx) {
      // Compatible with gen_inp.
      ctx.mcch = ctx.candidates.substr(
          ctx.candidates_start_index, self.selkey.length);
    }

    function UpdateComposition(ctx) {
      trace(ctx.composition);
      ctx.display_composition = '';
      for (var i = 0; i < ctx.composition.length; i++) {
        var c = ctx.composition[i];
        ctx.display_composition += self.keyname[c] || c;
      }
      // Compatible with gen_inp.
      ctx.keystroke = ctx.display_composition;

      PrepareCandidates(ctx, true);
    }

    function ShiftState(ctx) {
      trace(ctx.state);
      switch (ctx.state) {
        case self.STATE_COMPOSITION:
          ctx.state = self.STATE_CANDIDATES;
          ctx.candidates_start_index = 0;
          break;
        case self.STATE_CANDIDATES:
          ctx.state = self.STATE_COMPOSITION;
          ctx.candidates_start_index = 0;
          break;
      }
    }

    function IsSingleCandidate(ctx) {
      return ctx.candidates.length == 1;
    }

    function CanCycleCandidates(ctx) {
      return ctx.candidates.length > self.selkey.length;
    }

    function CycleCandidates(ctx, direction) {
      trace(ctx.candidates, ctx.candidates_start_index, direction);
      if (!CanCycleCandidates(ctx))
        return false;
      direction = direction || 1;
      var max = ctx.candidates.length;
      var cycle_size = self.selkey.length;
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

    function GlobCandidates(ctx) {
      var regex = Glob2Regex(ctx.composition);
      var lookup = Object.keys(self.table);
      ClearCandidates(ctx);

      // Currently looping with index is the fastest way to iterate an array.
      for (var i = 0, len = lookup.length; i < len; i++) {
        if (regex.test(lookup[i])) {
          ctx.candidates += self.table[lookup[i]];
          if (ctx.candidates.length >= self.MAX_GLOB_PAGES * ctx.selkey.length)
            break;
        }
      }
      UpdateCandidates(ctx);
      return ctx.candidates.length > 0;
    }

    function PrepareCandidates(ctx, is_autocompose) {
      trace(ctx.composition);
      var table = self.table;
      var key = ctx.composition;

      ClearCandidates(ctx);

      // Process override_* tables.
      if (is_autocompose) {
        if (self.override_autocompose) {
          if (self.override_autocompose[key])
            table = self.override_autocompose;
        } else if (!self.opts.OPT_AUTO_COMPOSE) {
          table = {};
        }
      } else {
        if (self.override_conversion && self.override_conversion[key])
          table = self.override_conversion;
      }

      if (IsGlobInPattern(key)) {
        GlobFromArray(key, Object.keys(table), function (key) {
          ctx.candidates += table[key];
          return (ctx.candidates.length >=
                  (self.MAX_GLOB_PAGES * self.selkey.length));
        });
      } else {
        // TODO(hungte) Currently cin_parser concats everything into a big
        // string, so candidates is a string. We should make it into an array.
        ctx.candidates = table[key] || '';
      }

      UpdateCandidates(ctx);
      return ctx.candidates.length > 0;
    }

    function IsCompositionKey(ctx, key) {
      return (key in self.keyname) || IsGlobKey(key);
    }

    function CanDoComposition(ctx, key) {
      // Some CIN tables like Array30 may include special keys (ex, selection
      // keys) as part of composition.
      if (self.table[ctx.composition + key])
        return true;
      return false;
    }

    function IsEmptyComposition(ctx) {
      return ctx.composition.length == 0;
    }

    function IsFullComposition(ctx) {
      return (self.max_composition &&
              ctx.composition.length >= self.max_composition);
    }

    function IsEmptyCandidates(ctx) {
      return ctx.candidates.length == 0;
    }

    function GetCompositionKeyGroup(ctx, key) {
      if (!self.keygroups)
        return undefined;
      for (var g in self.keygroups) {
        if (self.keygroups[g].indexOf(key) >= 0)
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
      // TODO(hungte) Make an index for DelComposition to delete last entered
      // key, or only update the displayed composition.
    }

    function AddComposition(ctx, key) {
      trace(ctx.composition, key);
      if (IsFullComposition(ctx))
        return false;

      var newgroup = GetCompositionKeyGroup(ctx, key);
      if (!newgroup || !CreateCompositionByGroups(ctx, newgroup, key)) {
        ctx.composition += key;
      }
      UpdateComposition(ctx);
      return true;
    }

    function DelComposition(ctx) {
      trace(ctx.composition);
      if (!ctx.composition.length)
        return false;
      ctx.composition = ctx.composition.replace(/.$/, '');
      UpdateComposition(ctx);
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
      return self.selkey.indexOf(key) >= 0 ||
             self.selkey2.indexOf(key) >= 0;
    }

    function IsEndKey(ctx, key) {
      trace(key);
      return self.endkey && self.endkey.indexOf(key) >= 0;
    }

    function SelectCommit(ctx, key) {
      trace(ctx.candidates, ctx.candidates_start_index, key);
      var key_idx = self.selkey.indexOf(key);
      if (key_idx < 0)
        key_idx = self.selkey2.indexOf(key);
      var index = (ctx.candidates_start_index + key_idx);
      return CommitText(ctx, index);
    }

    function ConvertComposition(ctx) {
      if (IsEmptyComposition(ctx))
        return ResultIgnored(ctx);
      if (!PrepareCandidates(ctx, false)) {
        return ResultError(ctx);
      }
      ShiftState(ctx);
      if (IsSingleCandidate(ctx) || self.opts.OPT_SPACE_AUTOUP) {
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

          if (CanDoComposition(ctx, key)) {
            if (IsEndKey(ctx, key)) {
              AddComposition(ctx, key);
              return ConvertComposition(ctx);
            }
          } else {
            if (IsSelectionKey(ctx, key) && !IsEmptyCandidates(ctx)) {
              if (SelectCommit(ctx, key))
                return ResultCommit(ctx);
              return ResultError(ctx);
            }
          }

          if (IsCompositionKey(ctx, key) || CanDoComposition(ctx, key)) {
            if (!AddComposition(ctx, key))
              return ResultError(ctx);

            if (self.opts.OPT_COMMIT_ON_FULL && IsFullComposition(ctx))
              return ConvertComposition(ctx);

            if (self.opts.OPT_COMMIT_ON_SINGLE_CANDIDATE &&
                IsSingleCandidate(ctx))
              return ConvertComposition(ctx);

            // Implicit endkeys (Array30/XCIN25 W[0-9])
            if (!IsCompositionKey(ctx, key))
              return ConvertComposition(ctx);

            return ResultProcessed(ctx);
          }
      }
      return ResultIgnored(ctx);
    }

    function ProcessCandidatesStateKey(ctx, ev) {
      var key = ev.key;

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
          CycleCandidates(ctx, -1);
          return ResultProcessed(ctx);

        case 'Right':
        case 'PageDown':
        case 'Down':
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

    this.ProcessKeystroke = function(ctx, ev) {
      trace(ev);
      if (ev.type != 'keydown' || ev.ctrlKey || ev.altKey) {
        return ResultIgnored(ctx);
      } else if (ev.key == 'Ctrl' || ev.key == 'Alt') {
        // when ctrl/alt is pressed, the ctrlKey / altKey are not true yet.
        return ResultIgnored(ctx);
      }

      switch (ctx.state) {
        case this.STATE_COMPOSITION:
          return ProcessCompositionStateKey(ctx, ev);
        case this.STATE_CANDIDATES:
          return ProcessCandidatesStateKey(ctx, ev);
      }
      return ResultIgnored(ctx);
    };
  },

  keystroke: function (ctx, ev) {
    return this.ProcessKeystroke(ctx, ev);
  },

  get_accepted_keys: function (ctx)
  {
    var keys = this.super.get_accepted_keys.call(this, ctx);
    if (ctx.state == this.STATE_COMPOSITION)
      keys = keys.concat(this.GLOB_KEYS.split(''));
    return keys;
  }
}));
