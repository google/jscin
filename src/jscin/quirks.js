// Copyright 2024 Google Inc. All Rights Reserved.

/**
 * @fileoverview Quirks for various CIN tables
 * @author Hung-Te Lin <hungte@gmail.com>
 */

import { jscin } from "./jscin.js";
import { AddLogger, Logged } from "./logger.js";
const {debug, warn, error, assert, trace} = AddLogger("quirks");
Logged(debug, warn, error, assert, trace);

function ApplyIfMissing(dest, src) {
  for (let k in src) {
    if (k in dest)
      continue;
    dest[k] = src[k];
  }
  return dest;
}

function GeneralQuirks(cin) {
  // Only table-commands (keyname, chardef) will be lowercased in cin_parser.
  // Any known one line params must be normalized to lower case.
  // The parser may leave the command as 'true' if no params so we have to
  // check.
  // 'endkey' may be optional so we want to leave that for the input module to
  // decide if they want to turn that into a string (or undefined).
  for (let cmd of ['selkey', 'endkey']) {
    if (!(cmd in cin))
      continue;

    let v = cin[cmd];
    if (v === true)
      v = '';
    else if (cin.keep_key_case)
      v = v || '';
    else
      v = (v || '').toLowerCase();
    cin[cmd] = v;
  }

  // Turn on AUTO_COMPOSE if the selkey does not overlap with keyname and
  // endkey, so we always know the selkey = "select candidate" when pressed
  // without ambiguity no matter if candidates are listed or not. Although, for
  // most other keys we can identify, and the most difficult one is SPACE. For
  // Phonetic, the SPACE is conversion also the endkey so we can't judge if the
  // SPACE should flip or convert.
  if (!('AUTO_COMPOSE' in cin)) {
    let v = true;
    for (let k of cin.selkey) {
      if (k in cin.keyname || cin.endkey?.includes(k)) {
        v = false;
        debug("selkey in keyname or endkey, set AUTO_COMPOSE default to false.",
          k, cin.keyname, cin.endkey);
        break;
      }
    }
    debug("Change AUTO_COMPOSE default to:", v);
    cin.AUTO_COMPOSE = v;
  }

  if (!('max_keystroke' in cin)) {
    let v = 0;
    for (let k in cin.chardef) {
      if (k.length > v) {
        v = k.length;
      }
    }
    debug("max_keystroke detected as:", v);
    cin.max_keystroke = '' + v;
  }
}

export function DetectInputMethodType(cin) {
  const detectors = {
    phonetic: {
      // We may add AUTO_COMPOSE=false and KEYGROUPS, but the PhoneticQuirks
      // already provided a better way to construct the keygroups.
      detect: { "ji3": "我" },
    },
    changjei: {
      detect: { "bmr": "同" },
    },
    simplex: {
      detect: { "ab": "晴" },
      opts: {
        AUTO_COMPOSE: false,
        AUTO_FULLUP: true,
      },
    },
    boshiamy: {
      detect: { "ca": "夕" },
      opts: {
        SELKEY_SHIFT: true,
        SPACE_AUTOUP: true,
        SPACE_RESET: true,
      },
    },
    dayi: {
      detect: { "mg": "字" },
      opts: {
        SELKEY_SHIFT: true,
      },
    },
    array30: {
      // AR 40 has / as 貝 instead , AR 26 does not have,
      detect: { "a": "一", "/": "虫" },
      opts: {
        'DISABLE_SEL_LIST': 'w',
        'KEYSTROKE_REMAP': {
          't': '的',
        }
      }
    },
  };

  for (let name in detectors) {
    let rule = detectors[name];
    let detect = rule.detect;
    let opts = rule.opts || {};

    assert(detect, "No detection rule defined in:", name);
    let matched = true;
    for (let [key, value] of Object.entries(detect)) {
      if (!cin.chardef[key]?.includes(value)) {
        matched = false;
        break;
      }
    }
    if (!matched)
      continue;
    debug("DetectInputMethodType: matched:", name, opts);
    ApplyIfMissing(cin, opts);
    return name;
  }
  return null;
}

function GcinQuirks(cin) {

  // quickkey (xcin2.3, openvanilla) and quick (gcin) are equivalent.
  if (cin.quickkey && !cin.quick) {
    cin.quick = cin.quickkey;
    delete cin.quickkey;
  }

  switch (parseInt(cin.space_style || "-1")) {
    case 0:
      // GTAB_space_auto_first_none: use the value set by .cin
      break;

    case 1:
      // GTAB_space_auto_first_any: Boshiamy
      cin.SPACE_AUTOUP = true;
      cin.SELKEY_SHIFT = true;
      cin.SPACE_RESET = true;
      break;

    case 2:
      // GTAB_space_auto_first_full: Simplex.
      cin.AUTO_FULLUP = true;
      break;

    case 4:
      // GTAB_space_auto_first_nofull: Windows Array30, Changjei.
      break;

    case 8:
      // GTAB_space_auto_first_dayi: Dayi (input:2, select:1).
      cin.SELKEY_SHIFT = true;
      break;

    case -1:
      break;

    default:
      trace("unknown space_style: ", cin.space_style);
      break;
  }

  // Decoding flags to % commands should be done in the gtab parser, but given
  // there may be unknown flags, we want to expand in the runtime.

  // Flags from GCIN 2.9.4 (not all commands have prefix 'flag_'):
  let flag = parseInt(cin.flag || "0");
  const flag_value_to_cmds = {
    keep_key_case: 0x01,
    symbol_kbm: 0x02,
    phrase_auto_skip_endkey: 0x04,
    flag_auto_select_by_phrase: 0x08,
    flag_disp_partial_match: 0x10,
    flag_disp_full_match: 0x20,
    flag_vertical_selection: 0x40,
    flag_press_full_auto_send: 0x80,
    flag_unique_auto_send: 0x100,
    flag_keypad_input_key: 0x200,
  };
  for (const [k, v] of Object.entries(flag_value_to_cmds)) {
    if (flag & v) {
      cin[k] = true;
      debug("quirks: Add GCIN command from flag:", k);
    }
  }

  const gcin_to_xcin25 = {
    flag_disp_partial_match: "AUTO_COMPOSE", // Technically we don't really support this yet.
    flag_disp_full_match: "AUTO_COMPOSE",
    flag_press_full_auto_send: "AUTO_FULLUP",
  };
  for (const [k, v] of Object.entries(gcin_to_xcin25)) {
    if (cin[k]) {
      cin[v] = true;
      debug("quirks: Altered GCIN command to XCIN25:", k, v);
    }
  }
}

// Space (' ') cannot be set in CIN selkey, so input methods like Dayi
// and Boshiamy that expecting to select the first candidate by Space,
// they need SELKEY_SHIFT. However when SPACE_AUTOUP is also set (like
// Boshiamy), SPACE = commit the first candidate so with RelatedText
// turned on, SPACE will keep committing unexpected words so '0' may a
// better choice - and implementations like Boshiamy on Mac does use 0.
//
// Some tables already took that into consideration and some don't,
// so we have to enforce using '0':
//
// - Official gcin (boshiamy-*.gtab):           123456789
// - Official cin  (boshiamy-c.cin, liu57.cin): 0123456789
// - Github cin-tables (boshiamy.cin):          1234567890
// - liu5.cin:                                  1234567890
// - liu7.cin:                                  0123456789
// - noseeing.cin (LuneIME):                    1234567890, %space_style=1
// - noseeing-12.gtb:                           1234567890
function SelkeyShiftQuirks(cin) {
  if (!cin.SELKEY_SHIFT)
    return;

  let k = cin.selkey || '';
  if (k.startsWith(' ')) {
    warn("SELKEY_SHIFT but selkey alreay started with SPACE.");
  }

  if (k.includes('123456789')) {
    // For a number sequce selkey, we can be pretty sure 0 should not be there.
    if (k.startsWith('0') || k.startsWith(' '))
      k = k.slice(1);
  }
  const c = cin.SPACE_AUTOUP ? '0' : ' ';
  k = c + k.replaceAll(c, '')
  debug("SELKEY_SHIFT: selkey", cin.selkey, '=>', k);

  cin.selkey = k;
}

function PhoneticQuirks(cin) {
  if (cin.KEYGROUPS)
    return;

  const groups = [
    'ㄅㄆㄇㄈㄉㄊㄋㄌㄍㄎㄏㄐㄑㄒㄓㄔㄕㄖㄗㄘㄙ',
    'ㄧㄨㄩ',
    'ㄚㄛㄜㄝㄞㄟㄠㄡㄢㄣㄤㄥㄦ',
  ];
  let keyname = cin.keyname;

  // First, check if all symbols in group are defined as key labels.
  let all_names = Object.values(keyname).join();
  for (let c of groups.join('')) {
    if (!all_names.includes(c))
      return;
  }

  // Now, reverse back.
  let reverse = {};
  for (let i in keyname) {
    reverse[keyname[i]] = i;
  }

  let r = groups.map((g) => {
    return g.split('').map((v) => {
      return reverse[v];
    }).join('');
  });

  cin.KEYGROUPS = Object.assign({}, r);
  debug("PhoneticQuirks: Added KEYGROUPS:", r);
}

function AddDefaultOptions(cin) {
  ApplyIfMissing(cin, jscin.OPTS);
}

/* Check and apply various patches to make the input table better. */
export function applyInputMethodTableQuirks(cin) {
  // GcinQuirks will extract the flag and normalize commands across gcin/xcin.
  GcinQuirks(cin);

  // DetectInputMethodType must be done before other general quirks so the
  // IM-specific default options will be applied.
  DetectInputMethodType(cin);

  // Normalize the table
  GeneralQuirks(cin);

  // IM specific quirks
  PhoneticQuirks(cin);
  SelkeyShiftQuirks(cin);

  // Default options should be applied at the last step.
  AddDefaultOptions(cin);
}
