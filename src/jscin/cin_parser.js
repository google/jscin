// Copyright 2011 Google Inc. All Rights Reserved.

/**
 * @fileoverview cin file parser.
 * @author zork@google.com (Zach Kuznia)
 */

// Returns an array, which is [success, cin, message].
// If success=true, cin is the valid parsed data. Otherwise, message contains
// the error message.
export function parseCin(cin_input) {
  let lines = cin_input.split('\n');
  let data = {};
  let runningcmd = null;
  let cmd;
  let table_command = {
    keyname: 1, chardef: 1,
    quick: 1, quickkey: 1,
    sel1st: 1, // re-order mappings, deprecated.
    octagram: 1, symboldef: 1, // CIN2 new commands
    KEYSTROKE_REMAP: 1, KEYGROUPS: 1, // XCINRC
  };

  // TODO for very old XCIN table (1.x~2.1b), there's no %chardef -- anything
  // not inside commands are chardefs.

  function failed(lineno, msg) {
    return [false, undefined, 'line ' + (lineno+1) + ': ' + msg];
  }

  for (let lineno in lines) {
    let line = lines[lineno];

    // Comment line start with '#'
    if (line.match(/^#/)) {
      continue;
    }

    // Command line
    let m = line.match(/^%(\w+)(?:\s+(\S+))?/);
    if (m) {
      cmd = m[1];
      let arg = m[2];
      if (table_command[cmd]) {
        if (arg == 'begin') {
          runningcmd = cmd;
          if (data[cmd] != undefined)
            return failed(lineno, `section already exists: ${cmd}`);
          data[cmd] = {};
        } else if (arg == 'end') {
          if (!runningcmd)
            return failed(lineno, `end before begin: ${cmd}`);
          runningcmd = null;
        } else {
          return failed(lineno, `should be begin/end: ${arg}`);
        }
      } else {
        if (runningcmd)
          return failed(lineno, `previous section has no end: ${runningcmd}`);
        if (arg == undefined)
          arg = true;
        else if (arg == 'false')
          arg = false;
        data[cmd] = arg;
      }
    } else if (table_command[cmd]) {
      // Extra arguments
      if (!cmd) continue;
      m = line.match(/^\s*(\S+)\s+(\S+)/);
      if (m) {
        let key = m[1];

        if (!data.keep_key_case)
          key = key.toLowerCase();

        // Always process chardef as phrases, and merge later.
        if (cmd == 'chardef') {
          if (data[cmd][key] == undefined)
            data[cmd][key] = [];
          data[cmd][key].push(m[2]);
          if (m[2].length > 1 && !data.PHRASE_CHARDEF)
            data.PHRASE_CHARDEF = true;
        } else {
          // Truncate all.
          if (data[cmd][key] == undefined)
            data[cmd][key] = '';
          data[cmd][key] += m[2];
        }
      } else {
        // bad line, just ignore
      }
    }
  }

  if (runningcmd && runningcmd != 'chardef') // iBus tables has no "%chardef end"
    return failed(lineno, 'previous section has no end');

  // merge data[chardef] entries.
  if (!data.PHRASE_CHARDEF) {
    for (let key in data.chardef) {
      data.chardef[key] = data.chardef[key].join('');
    }
  }

  // We want to keep the CIN AS-IS and prevent minimal changes (except the
  // cname/ename because they are critical for storing and showing). The
  // normalization and quirks should be applied only in the runtime - that will
  // help us to change the logic by updating the program. Check `quirks.js`
  // and `gen_inp[2].js` for further details.

  // Normalize and verify mandatory fields
  if (data.prompt && !data.cname) {  // gcin format
    data.cname = data.prompt;
  }
  let mandatory_command = [
    'ename', 'cname', 'selkey', 'keyname', 'chardef',
  ];
  for (let cmd of mandatory_command) {
    if (data[cmd] == undefined)
      return failed(-1, `missing mandatory section: %${cmd}`);
  }
  // TODO(hungte) Allow ename/cname to derive from each other.
  for (let cmd of ['ename', 'cname']) {
    if (data[cmd] === true)
      return failed(-1, `missing valid name: %${cmd}`);
  }

  // TOOD(hungte) Move selkey (can be default) and keyname (can be calculated)
  // as optional.

  // TODO (hungte) export this for migration.
  // Some CIN tables (https://github.com/chinese-opendesktop/cin-tables) have
  // ename in multi-locales format as `label:locale;label:local;...`.
  // One reference is https://vchewing.github.io/CIN_EVOLUTION.html but it was
  // using 'intlname'. Currently we have no plan to render the names for
  // different locales, however if the ename was using intlname format then we
  // have a problem in displaying and processing the storage so that must be
  // converted. Also, it's not easy to justify if a ename really wants ':'
  // (although it'll break croscin UI today) or it's intlname; so let's do a
  // tricky assumption 'Every intlname expects at least two locales, and "en"
  // is one of the locales'.
  function parseLocales(intlname) {
    const re = /(?<label>[^:;]+):(?<locale>[^:;]+);?/g;
    let result = {}
    for (let m of intlname.matchAll(re)) {
      result[[m.groups.locale]] = m.groups.label;
    }
    if (!Object.keys(result).length)
      return null;
    return result;
  }
  function normalizeEName(parsed, ename) {
    if (!ename.includes(':') || !ename.includes(';'))
      return;
    let r = parseLocales(ename);
    if (!r || !r.en)
      return;
    parsed.intlname = parsed.intlname || ename;
    parsed.ename = r.en;
  }

  normalizeEName(data, data.ename);

  return [true, data, 'Success'];
}
