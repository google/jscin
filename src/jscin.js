// Copyright 2011 Google Inc. All Rights Reserved.

/**
 * @fileoverview Top level definition of JavaScript CIN
 * @author kcwu@google.com (Kuang-che Wu)
 */

/**
 * The root namespace with constants
 */

var jscin = {
  'ENGINE_ID': "cros_cin",

  'IMKEY_ABSORB': 0x0,
  'IMKEY_COMMIT': 0x1,
  'IMKEY_IGNORE': 0x2,

  'MCCH_ONEPG': 0,
  'MCCH_BEGIN': 1,
  'MCCH_MIDDLE': 2,
  'MCCH_END': 3,
};

var ime_api = chrome.experimental.input.ime;

// Utilities

jscin.log = function(s) {
  if (typeof(console) == typeof(undefined)) {
    print(s);
  } else {
    console.log(s);
  }
}
