// Copyright 2011 Google Inc. All Rights Reserved.

/**
 * @fileoverview cin file parser.
 * @author zork@google.com (Zach Kuznia)
 */

// Returns an array, which is [true, parsed_data] on success, or [false, error
// message] on failure. parsed_data is an object, containing metadata and data.
function parseCin(cin_input) {
  var lines = cin_input.split('\n');
  var data = {};
  var runningcmd = null;
  var table_command = { 'keyname': 1, 'chardef': 1,
                        'quick': 1, 'quickkey': 1,
                        'KEYSTROKE_REMAP': 1, 'KEYGROUPS': 1 };

  var failed = function(lineno, msg) {
    return [false, 'line ' + (lineno+1) + ': ' + msg];
  }

  for (var lineno in lines) {
    var line = lines[lineno];

    // Comment line start with '#'
    if (line.match(/^#/)) {
      continue;
    }

    // Command line
    var m = line.match(/^%(\w+)(?:\s+(\S+))?/);
    if (m) {
      var cmd = m[1];
      var arg = m[2];
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
        var key = m[1];
        key = key.toUpperCase();
        if (data[cmd][key] == undefined)
          data[cmd][key] = '';
        data[cmd][key] += m[2];
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
  var mandatory_command = [
      'ename', 'cname', 'selkey', 'keyname', 'chardef'
      ];
  for (var i in mandatory_command) {
    if (data[mandatory_command[i]] == undefined)
      return failed(-1, 'mandatory section %' + mandatory_command[i] +
                    ' missing');
  }

  var parsed_data = {
    'metadata': {
      'ename': data.ename,
      'cname': data.cname,
    },
    'data': data,
  };

  return [true, parsed_data];
}
