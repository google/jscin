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
    else
      v = (v || '').toLowerCase();
    cin[cmd] = v;
  }
}

function Array30Quirks(cin) {
  // quickkey (xcin2.3, openvanilla) and quick (gcin) are equivalent.
  if (cin.quickkey && !cin.quick) {
    cin.quick = cin.quickkey;
    delete cin.quickkey;
  }
}

function BoshiamyQuirks(cin) {
  // Check tables/types.json for Boshiamy detection. Use `?.` because
  // not all tables have 'ca'.
  if (!cin.chardef['ca']?.includes('\u5915'))
    return false;

  // The Boshiamy tables may either set %space_style=1, or detected and then
  // set cin.{SELKEY_SHIFT,SPACE_AUTOUP}.

  if ('space_style' in cin) {
    if (cin.space_style != '1')
      return false;
  } else {
    if (!(cin.SELKEY_SHIFT && cin.SPACE_AUTOUP))
      return false;
  }

  // Space (' ') cannot be set in CIN selkey, so input methods like Dayi
  // and Boshiamy that expecting to select the first candidate by Space,
  // they need SELKEY_SHIFT. However when SPACE_AUTOUP is also set (like
  // Boshiamy), SPACE = commit the first candidate so with RelatedText
  // turned on, SPACE will keep committing unexpected words so '0' may a
  // better choice - and implementations like Boshiamy on Mac does use 0.
  //
  // Some tables already took that into consideration and some don't.
  // Unfortunately we have to 'guess' here for a better user experience.
  //
  // - Official gcin (boshiamy-*.gtab):           123456789
  // - Official cin  (boshiamy-c.cin, liu57.cin): 0123456789
  // - Github cin-tables (boshiamy.cin):          1234567890
  // - liu5.cin:                                  1234567890
  // - liu7.cin:                                  0123456789
  // - noseeing.cin (LuneIME):                    1234567890, %space_style=1
  // - noseeing-12.gtb:                           1234567890

  const known_list = [
    '123456789',
    '1234567890',
    '0123456789',
  ];
  // Not sure if there will be other IMs really expecting to do
  // SELKEY_SHIFT + SPACE_AUTOUP, so let's modify only specific keys.
  if (!known_list.includes(cin.selkey))
    return false;

  const newkey = '0123456789';
  debug("BoshiamyQuirks: changed selkey:", cin.selkey, newkey);
  cin.selkey = newkey;
  // Already shifted.
  delete cin.SELKEY_SHIFT;
  delete cin.space_style;
  return true;
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

  // Flags from GCIN 2.9.4:
  let flag = parseInt(cin.flag || "0");
  const flag_value_to_cmds = {
    flag_keep_key_case: 0x01,
    flag_gtab_sym_kbm: 0x02,
    flag_phrase_auto_skip_endkey: 0x04,
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

/* Check and apply various fixes or workarounds to make the input table
 * better. */
export function applyInputMethodTableQuirks(cin) {
  GeneralQuirks(cin);

  Array30Quirks(cin);
  BoshiamyQuirks(cin);

  // GcinQuirks must be applied after BoshiamyQuirks so the space_style can be
  // modified before being converted to XCIN commands.
  GcinQuirks(cin);
}
