// Copyright 2024 Google Inc. All Rights Reserved.

/**
 * @fileoverview Root namespace for JsCIN.
 * @author Hung-Te Lin <hungte@gmail.com>
 */

import { InputMethodsEnvironment } from "./ime.js";
import { AddLogger } from "./logger.js";
const { logger } = AddLogger("jscin");

export const IMKEY_ABSORB = 0x0;
export const IMKEY_COMMIT = 0x1;
export const IMKEY_IGNORE = 0x2;
export const IMKEY_DELAY  = 0x4;
export const IMKEY_ERROR  = 0x8;
export const IMKEY_UNKNOWN = 0x100;

export var jscin = new InputMethodsEnvironment();
jscin.IMKEY_ABSORB = IMKEY_ABSORB;
jscin.IMKEY_COMMIT = IMKEY_COMMIT;
jscin.IMKEY_IGNORE = IMKEY_IGNORE;
jscin.IMKEY_DELAY  = IMKEY_DELAY;
jscin.IMKEY_ERROR  = IMKEY_ERROR;
jscin.IMKEY_UNKNOWN= IMKEY_UNKNOWN;

// top level await is not always supported for example Chrome service works so
// let's init and expect things to finish on time...
jscin.initialize();

//////////////////////////////////////////////////////////////////////////////
// Global debugging

// In JavaScript debug console, type "jscin.logger" to change logger's state.
jscin.logger = logger;
