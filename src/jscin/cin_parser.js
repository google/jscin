// Copyright 2011 Google Inc. All Rights Reserved.

/**
 * @fileoverview cin file parser.
 * @author zork@google.com (Zach Kuznia)
 */

// Returns an array, which is [true, parsed_data] on success, or [false, error
// message] on failure. parsed_data is an object, containing metadata and data.
export function parseCin(cin_input) {
  let lines = cin_input.split('\n');
  let data = {};
  let runningcmd = null;
  let cmd;
  let table_command = {
    keyname: 1, chardef: 1,
    quick: 1, quickkey: 1,
    sel1st: 1, // re-order mappings, deprecated.
    KEYSTROKE_REMAP: 1, KEYGROUPS: 1,
  };

  // TODO for very old XCIN table (1.x~2.1b), there's no %chardef -- anything
  // not inside commands are chardefs.

  function failed(lineno, msg) {
    return [false, 'line ' + (lineno+1) + ': ' + msg];
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
            return failed(lineno, 'section already exists');
          data[cmd] = {};
        } else if (arg == 'end') {
          if (!runningcmd)
            return failed(lineno, 'end before begin');
          runningcmd = null;
        } else {
          return failed(lineno, 'should be begin/end');
        }
      } else {
        if (runningcmd)
          return failed(lineno, 'previous section has no end');
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
        // TODO(hungte) Don't convert if %keep_key_case is found.
        key = key.toLowerCase();
        if (cmd == 'chardef' && data['PHRASE_CHARDEF']) {
          if (data[cmd][key] == undefined)
            data[cmd][key] = [];
          data[cmd][key].push(m[2]);
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

  // verify mandatory fields
  if (data['prompt']) {  // gcin format
    data['cname'] = data['prompt'];
  }
  let mandatory_command = [
      'ename', 'cname', 'selkey', 'keyname', 'chardef'
      ];
  for (let i in mandatory_command) {
    if (data[mandatory_command[i]] == undefined)
      return failed(-1, 'mandatory section %' + mandatory_command[i] +
                    ' missing');
  }

  // Normalize mandatory commands without values
  if (data.selkey === true) {
    data.selkey = '';
  }

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

  let parsed_data = {
    metadata: {
      ename: data.ename,
      cname: data.cname,
      module: data.MODULE
    },
    data: data,
  };

  return [true, parsed_data];
}
