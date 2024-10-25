// Copyright 2014 Google Inc. All Rights Reserved.

/**
 * @fileoverview "CrossQuery" Addon
 * @author hungte@google.com (Hung-Te Lin)
 */

import { jscin } from "./jscin.js";
import { BaseInputAddon } from "./base_addon.js";

import { AddLogger } from "./logger.js";
const {log, debug, info, warn, error, assert, trace} = AddLogger("addon.CrossQuery");

let PROMPT = globalThis.chrome?.i18n?.getMessage('crossQueryAuxText') || "Look up:";

export class AddonCrossQuery extends BaseInputAddon
{
  constructor(name, im)
  {
    super(name, im);
    this.map = {};
    this.keyname = {}
    this.cross_name = null;
    this.label = '';
  }
  resetCross(ctx) {
    delete ctx.override_aux;
    this.map = {};
    this.keyname = {};
    this.cross_name = null;
    this.label = '';
  }
  keystroke(ctx, ev)
  {
    // Not actvated, don't care.
    if (!ctx.AddonCrossQuery) {
      if (this.cross_name)
        this.resetCross(ctx);
      return this.im.keystroke(ctx, ev);
    }

    // And expect the user won't commit text before we finish updating the map.
    this.updateMap(ctx.AddonCrossQuery);
    let ret = this.im.keystroke(ctx, ev);
    if (ret == jscin.IMKEY_COMMIT && ctx.cch.length == 1) {
      let cross = this.map[ctx.cch];
      if (cross) {
        cross = cross.split('').map((v) => this.keyname[v] || v).join('');
        ctx.override_aux = `${PROMPT}${ctx.cch} ${cross} ${this.label}`;
      }
      debug("IMKEY_COMMIT", ctx, ev, this.override_aux);
    }
    return ret;
  }
  async buildCharToKeyMap(name)
  {
    let map = {};
    this.map = map;
    this.label = '';

    if (!name)
      return;

    let table = await jscin.loadTable(name);
    if (!table) {
      error("buildCharToKeyMap: fail to load:", name);
      return;
    }
    let cin = table.cin;
    this.keyname = cin.keyname || {};
    debug("buildCharToKeyMap: table=", table, this.keyname);

    for(let key in cin.chardef) {
      for (let c of cin.chardef[key]) {
        if (c.length > 1)
          continue;
        if (c in map)
          continue;
        map[c] = key;
      }
    }
    this.map = map;
    this.label = cin.cname;
    return map;
  }
  async updateMap(cross_name) {
    if (cross_name == this.cross_name)
      return;
    this.cross_name = cross_name;
    this.buildCharToKeyMap(this.cross_name);
  }
}
jscin.registerAddon(AddonCrossQuery);
