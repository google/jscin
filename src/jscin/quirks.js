// Copyright 2024 Google Inc. All Rights Reserved.

/**
 * @fileoverview Quirks for various CIN tables
 * @author Hung-Te Lin <hungte@gmail.com>
 */

import { AddLogger } from "./logger.js";
const {log, debug, info, warn, error, assert, trace} = AddLogger("quirks");

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
  // without ambiguity no matter if candidates are listed or not.
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

function Array30Quirks(cin) {
  // quickkey (xcin2.3, openvanilla) and quick (gcin) are equivalent.
  if (cin.quickkey && !cin.quick) {
    cin.quick = cin.quickkey;
    delete cin.quickkey;
  }
}

function GcinQuirks(cin) {

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
    error("SELKEY_SHIFT but selkey alreay started with SPACE.");
    return;
  }

  if (cin.SPACE_AUTOUP && k.includes('123456789')) {
    k = '0' + k.replaceAll('0', '');
    debug("SELKEY_SHIFT + SPACE_AUTOUP: shift with '0':", k);
  } else {
    k = ' ' + k;
    debug(`SELKEY_SHIFT: new selkey=[${k}]`);
  }
  cin.selkey = k;
  delete cin.SELKEY_SHIFT;
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

  let r = {};
  for (let i in groups) {
    let v = groups[i].split('').map((v) => {
      return reverse[v];
    });
    r[parseInt(i)+1] = v.join('');
  }
  cin.KEYGROUPS = r;
  debug("PhoneticQuirks: Added KEYGROUPS:", r);
}

/* Check and apply various patches to make the input table better. */
export function applyInputMethodTableQuirks(cin) {
  // GcinQuirks will extract flag to more commands.
  GcinQuirks(cin);

  GeneralQuirks(cin);
  PhoneticQuirks(cin);
  Array30Quirks(cin);
  SelkeyShiftQuirks(cin);
}
