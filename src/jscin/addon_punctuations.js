// Copyright 2013 Google Inc. All Rights Reserved.

/**
 * @fileoverview "Punctuations" Addon
 * @author hungte@google.com (Hung-Te Lin)
 */

jscin.register_addon('AddonPunctuations', jscin.extend_input_method({
  constructor: function (name, conf)
  {
    this.ctrl_phrase = {
      ',': '\uff0c',
      '.': '\u3002',
      "'": '\u3001',
      ';': '\uff1b',
      '/': '\uff1f',  // Unfortunately this don't work well on ChromeOS.
      '[': '\u300c',
      ']': '\u300d'
    };

    this.ctrl_shift_phrase = {
      ';': '\uff1a',
      '/': '\uff1f',  // Unfortunately this don't work well on ChromeOS.
      '[': '\uff5b',
      ']': '\uff5d',
      '1': '\uff01',
      '9': '\uff08',
      '0': '\uff09',
    };

    // build key map
    var keys = [];
    Object.keys(this.ctrl_phrase).forEach(function (k) {
      keys.push('Ctrl ' + k);
    });
    Object.keys(this.ctrl_shift_phrase).forEach(function (k) {
      keys.push('Ctrl Shift ' + k);
    });
    this.expected_keys = keys;
  },

  keystroke: function (ctx, ev)
  {
    // TODO(hungte) Find better way to get allow_ctrl_phrase.
    if (!ev.ctrlKey || ev.altKey || !ctx.allow_ctrl_phrase)
      return this.im.keystroke(ctx, ev);

    var key = jscin.get_key_val(ev.code);
    var table = ev.shiftKey ? this.ctrl_shift_phrase : this.ctrl_phrase;
    if (!table[key])
      return this.im.keystroke(ctx, ev);

    ctx.cch = table[key];
    return jscin.IMKEY_COMMIT;
  },

  get_accepted_keys: function (ctx)
  {
    var keys = this.im.get_accepted_keys(ctx);
    if (ctx.allow_ctrl_phrase)
      keys = keys.concat(this.expected_keys);
    return keys;
  }
}, jscin.base_input_addon));
