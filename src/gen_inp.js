// Copyright 2011 Google Inc. All Rights Reserved.

/**
 * @fileoverview General Input Method Module
 * @author kcwu@google.com (Kuang-che Wu)
 */

// init for IME, ex. Zhuyin, Array
GenInp = function(name, conf) {
  this.name = name;

  var conf_mapping = {
    'AUTO_COMPOSE': 'INP_MODE_AUTOCOMPOSE',
    'AUTO_UPCHAR': 'INP_MODE_AUTOUPCHAR',
    'SPACE_AUTOUP': 'INP_MODE_SPACEAUTOUP',
    'SELKEY_SHIFT': 'INP_MODE_SELKEYSHIFT',
    'AUTO_FULLUP': 'INP_MODE_AUTOFULLUP',
    'SPACE_IGNORE': 'INP_MODE_SPACEIGNOR',
    'AUTO_RESET': 'INP_MODE_AUTORESET',
    'SPACE_RESET': 'INP_MODE_SPACERESET',
    'WILD_ENABLE': 'INP_MODE_WILDON',
    'BEEP_WRONG': 'INP_MODE_BEEPWRONG',
    'BEEP_DUPCHAR': 'INP_MODE_BEEPDUP',
    //'QPHRASE_MODE': 'modesc',
    //'DISABLE_SEL_LIST': 'disable_sel_list',
    //'KEYSTROKE_REMAP': 'kremap',
    'END_KEY': 'INP_MODE_ENDKEY',
  };
  this.conf = { 'mode': {} };
  for (var k in conf_mapping) {
    this.conf.mode[conf_mapping[k]] = conf[k];
  }
  this.conf.modesc = conf.QPHRASE_MODE;
  this.conf.disable_sel_list = conf.DISABLE_SEL_LIST;
  this.conf.kremap = conf.KEYSTROKE_REMAP;

  // load table
  // TODO(kcwu): create a Cin class.
  this.header = liu_cin_header;
  this.table = liu_table;

  if (this.header.endkey) {
    this.conf.mode.INP_MODE_ENDKEY = true;
  }
}

// init for each input instance
GenInp.prototype.new_instance = function(inpinfo) {
  var ime = this;
  var self = new Object();
  self.ime = ime;
  self.conf = ime.conf;
  // gen_inp_iccf_t iccf
  self.keystroke = [];
  self.mode = {};
  self.mcch_list = [];
  self.mkey_list = [];
  self.mcch_hidx = 0;
  self.mcch_eidx = 0;

  inpinfo.keystroke = '';
  inpinfo.suggest_skeystroke = '';

  if (!this.conf.mode.INP_MODE_SELKEYSHIFT) {
    inpinfo.selkey = ime.header.selkey;
  } else {
    inpinfo.selkey = ' ' + ime.header.selkey;
  }

  inpinfo.keystroke = '';
  inpinfo.mcch = [];
  inpinfo.mcch_pgstate = jscin.MCCH_ONEPG;
  inpinfo.lcch = [];
  inpinfo.cch_publish = '';

  // ------------------------------------------
  // member functions
  function return_wrong() {
    return jscin.IMKEY_ABSORB;
  }
  function return_correct() {
    return jscin.IMKEY_ABSORB;
  }
  function reset_keystroke(inpinfo) {
    trace('');
    self.keystroke = '';
    inpinfo.keystroke = '';
    inpinfo.mcch = [];
    self.keystroke = '';
    self.mode = {};
    inpinfo.mcch_pgstate = jscin.MCCH_ONEPG;
    self.mcch_list = [];
    self.mkey_list = [];
  }
  function match_keystroke_wild(inpinfo) {
    // TODO
    trace('NotImplemented');
    return match_keystroke_normal(inpinfo);
  }
  function match_keystroke_normal(inpinfo) {
    trace('');
    // TODO
    var result = ime.table[self.keystroke];
    trace('result = ' + self.keystroke);
    if (!result)
      return 0;

    trace('');
    var mcch = [];
    for (var i = 0; i < result.length; i++) {
      mcch.push(result[i]);
    }
    inpinfo.mcch = mcch.slice(0, inpinfo.selkey.length);

    if (inpinfo.mcch.length <= inpinfo.selkey.length) {
      trace('');
      inpinfo.mcch_pgstate = jscin.MCCH_ONEPG;
    } else {
      inpinfo.mcch_pgstate = jscin.MCCH_BEGIN;
      self.mcch_list = mcch;
      self.mcch_hidx = 0;
    }
    return 1;
  }
  function match_keystroke(inpinfo) {
    trace('');
    inpinfo.mcch = [];
    var ret;
    if (!self.mode.INPINFO_MODE_INWILD)
      ret = match_keystroke_normal(inpinfo);
    else
      ret = match_keystroke_wild(inpinfo);
    if (inpinfo.mcch.length > 1 && self.mode.INPINFO_MODE_SPACE)
      self.mode.INPINFO_MODE_SPACE;
    return ret;
  }
  function commit_char(inpinfo, cch) {
    trace('');
    // TODO
    inpinfo.cch = cch;
    if (!self.keystroke.match(/[*?]/)) {
      inpinfo.suggest_skeystroke = inpinfo.keystroke;
    } else {
      trace('NotImplemented');
      // ...
    }
    self.keystroke = '';
    inpinfo.keystroke = '';
    inpinfo.mcch = [];
    inpinfo.cch_publish = ''; // TODO
    inpinfo.mcch_pgstate = jscin.MCCH_ONEPG;

    self.mode.INPINFO_MODE_MCCH = false;
    self.mode.INPINFO_MODE_INWILD = false;
  }
  function commit_keystroke(inpinfo) {
    trace('');
    if (self.kremap) {
      trace('');
      if (self.kremap[self.keystroke]) {
        commit_char(inpinfo, self.kremap[self.keystroke]);
        return jscin.IMKEY_COMMIT;
      }
    }

    if (match_keystroke(inpinfo)) {
      trace('');
      // not undetstand yet
      if (inpinfo.mcch.length == 1) {
        commit_char(inpinfo, inpinfo.mcch);
        return jscin.IMKEY_COMMIT;
      } else {
        self.mode.INPINFO_MODE_MCCH = true;
        return return_correct();
      }
    } else {
      trace('');
      if (self.conf.mode.INP_MODE_AUTORESET)
        reset_keystroke(inpinfo);
      else
        self.mode.INPINFO_MODE_WRONG = true;
      return return_wrong();
    }
  }

  function mcch_choosech(inpinfo, idx) {
    if (!inpinfo.mcch && !match_keystroke(inpinfo)) {
      return 0;
    }

    if (idx < 0) {
      idx = 0;
    } else {
      if (self.conf.mode.INP_MODE_SELKEYSHIFT) {
        idx++;
      }
      if (idx >= inpinfo.selkey.length &&
          idx >= inpinfo.mcch.length) {
        return 0;
      }
    }

    commit_char(inpinfo, inpinfo.mcch[idx]);
    reset_keystroke(inpinfo);
  }

  function fillpage(inpinfo, dir) {
    var n_pg = inpinfo.selkey.length;

    if (!self.mode.INPINFO_MODE_INWILD) {
      switch (dir) {
        case 0:
          self.mcch_hidx = 0;
          break;
        case 1:
          if (self.mcch_hidx + n_pg < self.mcch_list.length)
            self.mcch_hidx += n_pg;
          else
            return 0;
          break;
        case -1:
          if (self.mcch_hidx - n_pg >= 0)
            self.mcch_hidx -= n_pg;
          else
            return 0;
          break;
      }
      inpinfo.mcch = self.mcch_list.slice(self.mcch_hidx, self.mcch_hidx+n_pg);

      if (self.mcch_hidx == 0)
        self.mcch_pgstate = self.mcch_hidx + n_pg < self.mcch_list.length ?
            jscin.MCCH_BEGIN : jscin.MCCH_ONEPG;
      else if (self.mcch_hidx + n_pg < self.mcch_list.length)
        self.mcch_pgstate = jscin.MCCH_MIDDLE;
      else
        self.mcch_pgstate = jscin.MCCH_END;
    } else {
      // wild mode
      trace('NotImplemented');
    }
    return 1;
  }
  function mcch_nextpage(inpinfo, key) {
    var ret = 0;
    switch (inpinfo.mcch_pgstate) {
      case jscin.MCCH_ONEPG:
        switch (key) {
          case ' ':
            if (self.conf.mode.INP_MODE_AUTOUPCHAR)
              ret = mcch_choosech(inpinfo, -1) ?
                  jscin.IMKEY_COMMIT : return_wrong();
            else
              ret = return_correct();
            break;
          case '<':
          case '>':
            ret = return_correct();
            break;
          default:
            ret = return_wrong();
            break;
        }
        break;

      case jscin.MCCH_END:
        switch (key) {
          case ' ':
          case '>':
            ret = fillpage(inpinfo, 0) ?
                jscin.IMKEY_ABSORB : return_wrong();
            break;
          case '<':
            ret = fillpage(inpinfo, -1) ?
                jscin.IMKEY_ABSORB : return_wrong();
            break;
          default:
            ret = return_wrong();
            break;
        }
        break;

      case jscin.MCCH_BEGIN:
        switch (key) {
          case ' ':
          case '>':
            ret = fillpage(inpinfo, 1) ?
                jscin.IMKEY_ABSORB : return_wrong();
            break;
          case '<':
            ret = return_correct();
            break;
          default:
            ret = return_wrong();
            break;
        }
        break;
    }
    return ret;
  }

  self.onKeystroke = function(inpinfo, keyinfo) {
    // shortcut
    var conf = self.conf;

    var len = inpinfo.keystroke.length;
    var max_len = ime.header.max_keystroke;

    trace('key: ' + keyinfo.key);
    if (self.mode.INPINFO_MODE_SPACE) {
      var sp_ignore = true;
      self.mode.INPINFO_MODE_SPACE = false;
    }
    if (self.mode.INPINFO_MODE_WRONG) {
      var inp_wrong = true;
      self.mode.INPINFO_MODE_WRONG = false;
    }

    if ((keyinfo.key == 'Backspace' || keyinfo.key == 'Delete') && len) {
      self.keystroke = self.keystroke.substr(0, len-1);
      inpinfo.keystroke = inpinfo.keystroke.substr(0, len-1);
      inpinfo.mcch = '';
      inpinfo.cch_publish = '';
      inpinfo.mcch_pgstate = jscin.MCCH_ONEPG;
      self.mode = {};
      if (conf.mode.INP_MODE_WILDON && self.keystroke.match(/[*?]/)) {
        self.mode.INPINFO_MODE_INWILD = true;
      }
      if (len > 1 && conf.mode.INP_MODE_AUTOCOMPOSE) {
        match_keystroke(inpinfo);
      }
      return jscin.IMKEY_ABSORB;
    } else if (keyinfo.key == 'Esc' && len) {
      // ...
      trace('NotImplemented');
    } else if (keyinfo.key == 'Space') {
      inpinfo.cch_publish = '';
      if (conf.mode.INP_MODE_SPACEAUTOUP &&
          (!self.mode.INPINFO_MODE_INWILD || self.mode.INPINFO_MODE_MCCH) &&
          (inpinfo.mcch.length > 1 || inpinfo.mcch_pgstate != jscin.MCCH_ONEPG)) {
        trace('');
        if (mcch_choosech(inpinfo, -1)) {
          return jscin.IMKEY_COMMIT;
        } else {
          if (conf.mode.INP_MODE_AUTORESET) {
            reset_keystroke(inpinfo);
          } else {
            self.mode.INPINFO_MODE_WRONG = false;
          }
          return return_wrong();
        }
      } else if (self.mode.INPINFO_MODE_MCCH) {
        trace('');
        // TODO INP_MODE_TABNEXTPAGE ?
        return mcch_nextpage(inpinfo, ' ');
      } else if (conf.mode.INP_MODE_SPACERESET && inp_wrong) {
        trace('');
        reset_keystroke(inpinfo);
        return jscin.IMKEY_ABSORB;
      } else if (sp_ignore) {
        trace('');
        return jscin.IMKEY_ABSORB;
      } else if (inpinfo.keystroke) {
        trace('');
        return commit_keystroke(inpinfo);
      }
    } else if (keyinfo.key == 'Tab' && conf.mode.INP_MODE_TABNEXTPAGE) {
      trace('');
      // ...
      trace('NotImplemented');
    } else if (0 /* keypad */) {
      trace('');
      return jscin.IMKEY_IGNORE;
    } else if (keyinfo.key.length == 1) {
      trace('');
      var ret = jscin.IMKEY_ABSORB;
      var endkey_pressed = false;

      inpinfo.cch_publish = '';
      var wch = ime.header.keyname[keyinfo.key];
      var selkey_idx = ime.header.selkey.indexOf(keyinfo.key);
      if (ime.header.endkey.indexOf(self.keystroke[self.keystroke.length-1]) >=0 ) {
        endkey_pressed = true;
      }
      trace('');

      if (len && selkey_idx != -1 && (endkey_pressed || !wch)) {
        if (len == 1 && conf.disable_sel_list &&
            conf.disable_sel_list.indexOf(self.keystroke[self.keystroke.length-1])) {
          wch = keyinfo.key;
        } else {
          return mcch_choosech(inpinfo, selkey_idx) ? jscin.IMKEY_COMMIT: return_wrong();
        }
      } else if (keyinfo.key.match(/[<>]/) &&
                 1 /* GUIMOD_SELKEYSPOT ? */) {
        return mcch_nextpage(inpinfo, keyinfo.key);
      } else if (self.mode.INPINFO_MODE_MCCH) {
        if (selkey_idx != -1) {
          return mcch_choosech(inpinfo, selkey_idx) ? jscin.IMKEY_COMMIT: return_wrong();
        } else if (conf.mode.INP_MODE_AUTOUPCHAR) {
          if (!mcch_choosech(inpinfo, -1))
            return return_wrong();
          ret |= jscin.IMKEY_COMMIT;
        } else {
          return return_wrong();
        }
      }
      trace('');

      len = inpinfo.keystroke.length;

      // TODO keystate
      if (0 /* ShiftMask */) {
      } else if (0 /* ControlMask */) {
      } else if (0 /* Mod1Mask */) {
      } else if (!wch) {
        return ret | jscin.IMKEY_IGNORE;
      } else if (len >= max_len) {
        return return_wrong();
      }

      self.keystroke += keyinfo.key;

      if (keyinfo.key.match(/^[*?]$/)) {
        inpinfo.keystroke += keyinfo.key;
      } else {
        inpinfo.keystroke += wch;
      }
      len++;
      trace('');

      if (conf.mode.INP_MODE_SPACEIGNOR && len == max_len) {
        self.mode.INPINFO_MODE_SPACE = false;
      }
      if (conf.mode.INP_MODE_ENDKEY && len>1 &&
          ime.header.endkey.indexOf(keyinfo.key) >= 0) {
        return commit_keystroke(inpinfo);
      } else if (conf.mode.INP_MODE_AUTOFULLUP && len == max_len) {
        return commit_keystroke(inpinfo);
      } else if (conf.mode.INP_MODE_AUTOCOMPOSE) {
        match_keystroke(inpinfo);
      }
      return ret;
    }

    return jscin.IMKEY_IGNORE;
  }
  self.show_keystroke = function(conf, simdinfo) {
    trace('NotImplemented');
    return 0;
  }
  return self;
}

//////////////////////////////////////////////////////////////////////////////
// Debugging and unit tests

function dump_object(obj, indent) {
  if (obj == null) return 'null';
  if (typeof(obj) == 'string') return "'" + obj + "'";
  if (typeof(obj) != 'object') return obj;
  if (obj.constructor.toString().match(/array/i)) {
    return '[' + obj + ']';
  }

  var prefix = '';
  for (var i = 0; i < indent; i++) prefix += ' ';

  var s = '';
  for (var k in obj) {
    s += prefix + k + ': ' + dump_object(obj[k], indent+2) + '\n';
  }
  return s;
}

function dump_inpinfo(inpinfo) {
  return dump_object(inpinfo, 2);
}

function simulate(inst, inpinfo, input) {
  for (var i in input) {
    var keyinfo = {'key': input[i]};
    var ret = inst.onKeystroke(inpinfo, keyinfo);
    print('ret = ' + ret);
    print(dump_inpinfo(inpinfo));
    print('');
  }
}

function console_trace(s) {
  var e = new Error();
  var m = e.stack.toString().match(/^.*\n.*\n.*at (.+) \((.*):(\d+):\d+\)/);
  var prefix = m[2] + ':' + m[3] + ' [' + m[1] + ']: ';
  var msg = prefix + s;
  print(msg);
}

function main() {
  var inpinfo = {};
  var try_with_jscin = false;
  var liu_inst = null;

  if (try_with_jscin) {
    liu_inst = jscin.create_input_method('liu', inpinfo);
  } else {
    var liu = new GenInp('liu', liu_conf);
    liu_inst = liu.new_instance(inpinfo);
  }

  simulate(liu_inst, inpinfo, ['a', 'Space']);
  simulate(liu_inst, inpinfo, ['l', 'n', 'Space']);
  simulate(liu_inst, inpinfo, ['l', 'n', '1']);
}

// Entry stub
if (typeof(console) == typeof(undefined)) {
  load('jscin.js');
  jscin.register_module('GenInp', GenInp);
  load('hardcode.js');
  trace = console_trace;
  main();
} else {
  // jscin must be already loaded.
  jscin.register_module('GenInp', GenInp);
  trace = jscin.log;
}
