// Copyright 2011 Google Inc. All Rights Reserved.

/**
 * @fileoverview General Input Method Module
 * @author kcwu@google.com (Kuang-che Wu)
 */

// General Input Module for table-based IMs, ex. Zhuyin, Array
jscin.register_module('GenInp', jscin.extend_input_method({

  constructor: function (name, conf)
  {
    var default_conf = {
      AUTO_COMPOSE: true,
      AUTO_UPCHAR: true,
      AUTO_FULLUP: false,
      SPACE_AUTOUP: false,
      SELKEY_SHIFT: false,
      SPACE_RESET: true,
      AUTO_RESET: false,
      WILD_ENABLE: true,
      SINMD_IN_LINE1: false,
      END_KEY: false,
      QPHRASE_MODE: 0,
      DISABLE_SEL_LIST: '',
      KEYSTROKE_REMAP: {},
      BEEP_WRONG: true,
      BEEP_DUPCHAR: true,
    };

    var conf_mapping = {
      AUTO_COMPOSE: 'INP_MODE_AUTOCOMPOSE',
      AUTO_UPCHAR: 'INP_MODE_AUTOUPCHAR',
      SPACE_AUTOUP: 'INP_MODE_SPACEAUTOUP',
      SELKEY_SHIFT: 'INP_MODE_SELKEYSHIFT',
      AUTO_FULLUP: 'INP_MODE_AUTOFULLUP',
      SPACE_IGNORE: 'INP_MODE_SPACEIGNOR',
      AUTO_RESET: 'INP_MODE_AUTORESET',
      SPACE_RESET: 'INP_MODE_SPACERESET',
      WILD_ENABLE: 'INP_MODE_WILDON',
      BEEP_WRONG: 'INP_MODE_BEEPWRONG',
      BEEP_DUPCHAR: 'INP_MODE_BEEPDUP',
      END_KEY: 'INP_MODE_ENDKEY',
    };
    this.conf = { mode: {} };
    for (var k in conf_mapping) {
      if (!(k in conf)) {
        this.conf.mode[conf_mapping[k]] = default_conf[k];
      } else {
        this.conf.mode[conf_mapping[k]] = conf[k];
      }
    }
    // GCIN space_style
    switch (parseInt(conf.space_style || "-1")) {
      // Boshiamy
      case 1: this.conf.mode.INP_MODE_SELKEYSHIFT = true;
              this.conf.mode.INP_MODE_SPACEAUTOUP = true;
              break;
      // Simplex
      case 2: this.conf.mode.INP_MODE_AUTOFULLUP = true;
              break;
      // Dayi
      case 8: this.conf.mode.INP_MODE_SELKEYSHIFT = true;
              break;
    }
    this.conf.modesc = conf.QPHRASE_MODE;  // not support
    this.conf.disable_sel_list = conf.DISABLE_SEL_LIST;
    if (this.conf.disable_sel_list) {
      this.conf.disable_sel_list = this.conf.disable_sel_list.toLowerCase();
    }
    this.conf.kremap = conf.KEYSTROKE_REMAP;
    this.conf.keygroups = conf.KEYGROUPS;

    // load table
    // TODO(kcwu) dirty hack now
    this.header = conf;
    this.table = conf.chardef;
    this.header.max_keystroke = parseInt(this.header.max_keystroke);

    if (this.header.endkey == undefined)
      this.header.endkey = '';
    if (this.header.endkey) {
      this.conf.mode.INP_MODE_ENDKEY = true;
    }

    this.MCCH_ONEPG = 0;
    this.MCCH_BEGIN = 1;
    this.MCCH_MIDDLE = 2;
    this.MCCH_END = 3;
  },

  reset_context: function (inpinfo)
  {
    this.super.reset_context.call(this, inpinfo);
    var ime = this;
    if (!this.conf.mode.INP_MODE_SELKEYSHIFT) {
      inpinfo.selkey = ime.header.selkey;
    } else {
      inpinfo.selkey = ' ' + ime.header.selkey;
    }

    inpinfo.suggest_skeystroke = '';
    inpinfo.mcch_pgstate = ime.MCCH_ONEPG;
    inpinfo.cch_publish = '';
  },

  init: function (inpinfo)
  {
    this.super.init.call(this, inpinfo);

    var ime = this;
    var self = {};
    self.ime = ime;
    self.conf = ime.conf;
    // gen_inp_iccf_t iccf
    self.keystroke = '';
    self.display_keystroke = [];
    self.mode = {};
    self.mcch_list = [];
    self.mkey_list = [];
    self.mcch_hidx = 0;
    self.mcch_eidx = 0;

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
      self.display_keystroke = [];
      inpinfo.keystroke = '';
      inpinfo.mcch = [];
      inpinfo.mcch_pgstate = ime.MCCH_ONEPG;
      self.mode = {};
      self.mcch_list = [];
      self.mkey_list = [];
    }
    function wildcard2re(s) {
      return s.replace('.', '\\.').replace('?', '.').replace('*', '.*');
    }
    function pick_cch_wild(head, dir, keystroke, mcch_size) {
      var mcch = [];
      var more = false;

      // Object.keys() is in standard since ECMAScript 5 and is only
      // implemented in new browsers.
      var keys = ime.table.keys();
      if (dir == 1) {
        for (i=0, idx=head; idx<keys.length && i<=mcch_size; idx++) {
          if (keys[i].match(pattern)) {
            if (i < mcch_size) {
              // FIXME(kcwu) only show first
              mcch.push(keys[idx][0]);
              i++;
            } else {
              more = true;
            }
          }
        }
      } else {
        trace('NotImplemented');
      }

      return {'more': more, 'mcch': mcch, 'end': idx };
    }
    function match_keystroke_wild(inpinfo) {
      trace('');
      return match_keystroke_normal(inpinfo);

      // TODO optimize
      var idx = 0;
      var pattern = wildcard2re(self.keystroke);
      trace('pattern = ' + pattern);

      for (var k in ime.table) {
        if (k.match(pattern)) {
          break;
        }
        idx++;
      }
      self.mcch_hidx = idx;

      var result = pick_cch_wild(idx, 1, self.keystroke, inpinfo.selkey.length);
      if (!result.more) {
        inpinfo.mcch_pgstate = ime.MCCH_ONEPG;
      } else {
        inpinfo.mcch_pgstate = ime.MCCH_BEGIN;
      }

      inpinfo.mcch = result.mcch;
      self.mcch_eidx = result.end;
      return !!inpinfo.mcch.length;
    }
    function match_keystroke_normal(inpinfo) {
      trace('');
      // TODO
      var result = ime.table[self.keystroke];
      if (!result) {
        return 0;
      }

      var mcch = [];
      for (var i = 0; i < result.length; i++) {
        mcch.push(result[i]);
      }
      inpinfo.mcch = mcch.slice(0, inpinfo.selkey.length);

      if (mcch.length <= inpinfo.selkey.length) {
        inpinfo.mcch_pgstate = ime.MCCH_ONEPG;
      } else {
        inpinfo.mcch_pgstate = ime.MCCH_BEGIN;
        self.mcch_list = mcch;
        self.mcch_hidx = 0;
      }
      return 1;
    }
    function match_keystroke(inpinfo) {
      inpinfo.mcch = [];
      var ret;
      if (!self.mode.INPINFO_MODE_INWILD)
        ret = match_keystroke_normal(inpinfo);
      else
        ret = match_keystroke_wild(inpinfo);
      if (inpinfo.mcch.length > 1 && self.mode.INPINFO_MODE_SPACE)
        self.mode.INPINFO_MODE_SPACE = false;
      return ret;
    }
    function commit_char(inpinfo, cch) {
      trace('cch = ' + cch);
      // TODO
      inpinfo.cch = cch;
      if (!self.keystroke.match(/[*?]/)) {
        inpinfo.suggest_skeystroke = inpinfo.keystroke;
      } else {
        trace('NotImplemented');
        // ...
      }
      self.keystroke = '';
      self.display_keystroke = [];
      inpinfo.keystroke = '';
      inpinfo.mcch = [];
      inpinfo.cch_publish = ''; // TODO
      inpinfo.mcch_pgstate = ime.MCCH_ONEPG;

      self.mode.INPINFO_MODE_MCCH = false;
      self.mode.INPINFO_MODE_INWILD = false;
    }
    function commit_keystroke(inpinfo) {
      trace('');
      if (self.conf.kremap) {
        if (self.conf.kremap[self.keystroke]) {
          commit_char(inpinfo, self.conf.kremap[self.keystroke]);
          return jscin.IMKEY_COMMIT;
        }
      }

      if (match_keystroke(inpinfo)) {
        trace('');
        // not undetstand yet
        if (inpinfo.mcch.length == 1) {
          commit_char(inpinfo, inpinfo.mcch[0]);
          return jscin.IMKEY_COMMIT;
        } else {
          self.mode.INPINFO_MODE_MCCH = true;
          return return_correct();
        }
      } else {
        if (self.conf.mode.INP_MODE_AUTORESET)
          reset_keystroke(inpinfo);
        else
          self.mode.INPINFO_MODE_WRONG = true;
        return return_wrong();
      }
    }

    function mcch_choosech(inpinfo, idx) {
      trace('');
      if (!inpinfo.mcch && !match_keystroke(inpinfo)) {
        return 0;
      }

      if (idx < 0) {
        idx = 0;
      } else {
        if (self.conf.mode.INP_MODE_SELKEYSHIFT) {
          idx++;
        }
        if (idx >= inpinfo.selkey.length ||
            idx >= inpinfo.mcch.length) {
          return 0;
        }
      }

      commit_char(inpinfo, inpinfo.mcch[idx]);
      reset_keystroke(inpinfo);
      return 1;
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

        if (self.mcch_hidx == 0) {
          trace('');
          inpinfo.mcch_pgstate = self.mcch_hidx + n_pg < self.mcch_list.length ?
              ime.MCCH_BEGIN : ime.MCCH_ONEPG;
        } else if (self.mcch_hidx + n_pg < self.mcch_list.length) {
          trace('');
          inpinfo.mcch_pgstate = ime.MCCH_MIDDLE;
        } else {
          trace('');
          inpinfo.mcch_pgstate = ime.MCCH_END;
        }
      } else {
        // wild mode
        trace('NotImplemented');
      }
      return 1;
    }
    function mcch_nextpage(inpinfo, key) {
      trace('');
      var ret = 0;
      switch (inpinfo.mcch_pgstate) {
        case ime.MCCH_ONEPG:
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

        case ime.MCCH_END:
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

        case ime.MCCH_BEGIN:
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

    // For zhuyin, reorder keystrokes.
    function reorder_key_by_keygroups(inpinfo, keyinfo) {
      if (!self.conf.keygroups) {
        return false;
      }

      function determine_group(key) {
        for (var g in self.conf.keygroups) {
          if (self.conf.keygroups[g].indexOf(key) >= 0) {
            return g;
          }
        }
        return undefined;
      }

      var key_by_group = {};
      for (var i in self.keystroke) {
        var g = determine_group(self.keystroke[i]);
        if (!g) return false;  // only reorder if all keys are in known group
        key_by_group[g] = self.keystroke[i];
      }

      var g = determine_group(keyinfo.key);
      if (!g)
        return false;

      key_by_group[g] = keyinfo.key;

      // reconstruct keystroke sequence
      var groups_in_order = Object.keys(key_by_group).sort();
      self.keystroke = '';
      self.display_keystroke = [];
      for (var i in groups_in_order) {
        var ch = key_by_group[groups_in_order[i]];
        self.keystroke += ch;
        self.display_keystroke.push(self.ime.header.keyname[ch]);
      }
      inpinfo.keystroke = self.display_keystroke.join('');

      return true;
    }

    // ------------------------------------------
    // main entry
    this.process_keystroke = function (inpinfo, keyinfo) {
      var conf = self.conf;

      var len = self.keystroke.length;
      var max_len = ime.header.max_keystroke;

      trace('keyinfo: ' + JSON.stringify(keyinfo));
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
        self.display_keystroke = self.display_keystroke.slice(0, len-1);
        inpinfo.keystroke = self.display_keystroke.join('');
        inpinfo.mcch = '';
        inpinfo.cch_publish = '';
        inpinfo.mcch_pgstate = ime.MCCH_ONEPG;
        self.mode = {};
        if (conf.mode.INP_MODE_WILDON && self.keystroke.match(/[*?]/)) {
          self.mode.INPINFO_MODE_INWILD = true;
        }
        if (len > 1 && conf.mode.INP_MODE_AUTOCOMPOSE) {
          match_keystroke(inpinfo);
        }
        return jscin.IMKEY_ABSORB;
      } else if (keyinfo.key == 'Esc' && len) {
        reset_keystroke(inpinfo);
        inpinfo.cch_publish = '';
        inpinfo.mcch_pgstate = ime.MCCH_ONEPG;
        return jscin.IMKEY_ABSORB;
      } else if (keyinfo.key == ' ') {
        inpinfo.cch_publish = '';
        if (conf.mode.INP_MODE_SPACEAUTOUP &&
            (!self.mode.INPINFO_MODE_INWILD || self.mode.INPINFO_MODE_MCCH) &&
            (inpinfo.mcch.length > 1 || inpinfo.mcch_pgstate != ime.MCCH_ONEPG))
        {
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
        } else if (self.keystroke) {
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
        if (ime.header.endkey.indexOf(
            self.keystroke[self.keystroke.length-1]) >=0 ) {
          endkey_pressed = true;
        }

        if (len && selkey_idx != -1 && (endkey_pressed || !wch)) {
          if (len == 1 && conf.disable_sel_list &&
              conf.disable_sel_list.indexOf(
                  self.keystroke[self.keystroke.length-1]) >= 0) {
            wch = keyinfo.key;
          } else {
            return (mcch_choosech(inpinfo, selkey_idx) ? jscin.IMKEY_COMMIT :
                                                         return_wrong());
          }
        } else if (keyinfo.key.match(/[<>]/) &&
                   1 /* GUIMOD_SELKEYSPOT ? */) {
          return mcch_nextpage(inpinfo, keyinfo.key);
        } else if (self.mode.INPINFO_MODE_MCCH) {
          if (selkey_idx != -1) {
            return (mcch_choosech(inpinfo, selkey_idx) ? jscin.IMKEY_COMMIT :
                                                         return_wrong());
          } else if (conf.mode.INP_MODE_AUTOUPCHAR) {
            if (!mcch_choosech(inpinfo, -1))
              return return_wrong();
            ret |= jscin.IMKEY_COMMIT;
          } else {
            return return_wrong();
          }
        }
        trace('wch = ' + wch);

        len = self.keystroke.length;

        if (keyinfo.ctrlKey) {
          return jscin.IMKEY_IGNORE;  // don't support qphrase
        } else if (keyinfo.shiftKey) {
          if (conf.mode.INP_MODE_WILDON && keyinfo.key.match(/^[*?]$/)) {
            self.mode.INPINFO_MODE_INWILD = true;
          } else {
            return jscin.IMKEY_IGNORE;  // don't support qphrase
          }
        } else if (keyinfo.altKey) {
          return jscin.IMKEY_IGNORE;  // don't support qphrase
        } else if (!wch) {
          return ret | jscin.IMKEY_IGNORE;
        } else if (reorder_key_by_keygroups(inpinfo, keyinfo)) {
          // Note, INP_MODE_AUTOFULLUP is not respected if KEYGROUPS is enabled.
          if (conf.mode.INP_MODE_AUTOCOMPOSE) {
            match_keystroke(inpinfo);
          }
          return ret;
        } else if (len >= max_len) {
          return return_wrong();
        }

        self.keystroke += keyinfo.key;

        if (keyinfo.key.match(/^[*?]$/)) {
          self.display_keystroke.push(keyinfo.key);
        } else {
          self.display_keystroke.push(wch);
        }
        inpinfo.keystroke = self.display_keystroke.join('');
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
    };
  },

  keystroke: function (inpinfo, keyinfo)
  {
    return this.process_keystroke(inpinfo, keyinfo);
  }
}));
