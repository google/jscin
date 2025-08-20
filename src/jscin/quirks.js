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
  cin.selkey = (cin.selkey || '').toLowerCase();
  cin.endkey = (cin.endkey || '').toLowerCase();
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

/* Check and apply various fixes or workarounds to make the input table
 * better. */
export function applyInputMethodTableQuirks(cin) {
  GeneralQuirks(cin);
  Array30Quirks(cin);
  BoshiamyQuirks(cin);
}
