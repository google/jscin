// Copyright 2014 Google Inc. All Rights Reserved.

/**
 * @fileoverview Logging utilities
 * @author hungte@gmail.com (Hung-Te Lin)
 *
 * Usage:
 *  import { AddLogger } from "./logger.js";
 *  const {log, debug, info, warn, error, assert, trace, logger} = AddLogger("module");
 */

export var AllLoggers = {};

export class Logger {
  constructor(module="jscin", verbose=false) {
    this.module = module;
    this.verbose = verbose;
    this.consoles = [console];
    this.headers = {
      debug: this.getHeader('|DEBUG'),
      log: this.getHeader(),
      info: this.getHeader('|INFO'),
      warn: this.getHeader('|WARNING'),
      error: this.getHeader('|ERROR'),
      trace: this.getHeader('|TRACE'),
    };
  }

  getHeader(ext='') {
    return `[${this.module}${ext}]`
  }

  /* console.* APIs */

  log(...args) {
    for (let c of this.consoles) {
      c.log(this.headers.log, ...args);
    }
  }

  debug(...args) {
    /* We don't use console.debug because it will still consume memory. */
    if (!this.verbose)
      return;
    // TODO It may be even better if we can "always output to the extra
    // consoles, and verbosity only controls the first console.
    for (let c of this.consoles) {
      c.log(this.headers.debug, ...args);
    }
  }

  info(...args) {
    for (let c of this.consoles) {
      c.info(this.headers.info, ...args);
    }
  }

  warn(...args) {
    for (let c of this.consoles) {
      c.warn(this.headers.warn, ...args);
    }
  }

  error(...args) {
    for (let c of this.consoles) {
      c.error(this.headers.error, ...args);
    }
  }

  assert(...args) {
    for (let c of this.consoles) {
      c.assert(...args);
    }
  }

  trace(...args) {
    if (!this.verbose)
      return;
    for (let c of this.consoles) {
      c.trace(this.headers.trace, ...args);
    }
  }

  // Turn on/off debug/trace messages.
  enable(flag=true) {
    this.verbose = flag;
    return this;
  }

  getEnabled() {
    return this.verbose;
  }

  addConsole(c) {
    this.consoles.push(c);
    return this;
  }

  getExports() {
    this.addInstance();
    return {
      log: this.log.bind(this),
      debug: this.debug.bind(this),
      info: this.info.bind(this),
      warn: this.warn.bind(this),
      error: this.error.bind(this),
      assert: this.assert.bind(this),
      trace: this.trace.bind(this),
      logger: this.getLogger(),
    };
  }

  getLogger() {
    return this;
  }

  getAllLoggers() {
    return AllLoggers;
  }

  enableAllLoggers(flag=true) {
    for (let name in AllLoggers) {
      AllLoggers[name].enable(flag);
    }
  }

  addInstance() {
    let name = this.module;
    if (name in AllLoggers) {
      for (let i = 1; name in AllLoggers ; i++) {
        name = `${this.module}.${i}`;
      }
    }
    this.assert(!(name in AllLoggers), "Registered too many times:", this.module);
    AllLoggers[name] = this;
  }
}

export function AddLogger(name) {
  return new Logger(name).getExports();
}

export function Logged() {
  // An empty place holder.
}
