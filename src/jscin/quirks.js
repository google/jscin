// Copyright 2024 Google Inc. All Rights Reserved.

/**
 * @fileoverview Quirks for various tables
 * @author Hung-Te Lin <hungte@gmail.com>
 */

import { AddLogger } from "./logger.js";
const {log, debug, info, warn, error, assert, trace} = AddLogger("gen_inp2");

function BoshiamyQuirks(data) {
  if (!(data.SELKEY_SHIFT && data.SPACE_AUTOUP))
    return false;

  // Check options/builtin_options.json for Boshiamy detection.
  if (!data.chardef['ca'].includes('\u5915'))
    return false;

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
  if (!known_list.includes(data.selkey))
    return false;

  const newkey = '0123456789';
  debug("BoshiamyQuirks: changed selkey:", data.selkey, newkey);
  data.selkey = newkey;
  // Already shifted.
  delete data.SELKEY_SHIFT;
  return true;
}

/* Check and apply various fixes or workarounds to make the input table
 * better. */
export function applyInputMethodTableQuirks(data) {
  // Adjust any context data.
  BoshiamyQuirks(data);
}
