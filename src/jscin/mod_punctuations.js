// Copyright 2013 Google Inc. All Rights Reserved.

/**
 * @fileoverview "Punctuations" Module
 * @author hungte@google.com (Hung-Te Lin)
 */

ModPunctuations = function(im) {
  var self = this;
  self.im = im;
  self.ctrl_phrase = {
    ',': '\uff0c',
    '.': '\u3002',
    "'": '\u3001',
    ';': '\uff1b',
    '/': '\uff1f',  // Unfortunately this don't work well on ChromeOS.
    '[': '\u300c',
    ']': '\u300d'
  };

  self.ctrl_shift_phrase = {
    ';': '\uff1a',
    '/': '\uff1f',  // Unfortunately this don't work well on ChromeOS.
    '[': '\uff5b',
    ']': '\uff5d',
    '1': '\uff01',
    '9': '\uff08',
    '0': '\uff09',
  };

  self.onKeystroke = function(ctx, ev) {
    var key = ev.key;
    // TODO(hungte) Find better way to get allow_ctrl_phrase.
    if (!ev.ctrlKey || ev.altKey || !ctx.allow_ctrl_phrase)
      return im.onKeystroke(ctx, ev);

    if (ev.shiftKey)
      key = jscin.unshift_key(key);

    var table = ev.shiftKey ? self.ctrl_shift_phrase : self.ctrl_phrase;
    if (!table[key])
      return im.onKeystroke(ctx, ev);

    ctx.cch = table[key];
    return jscin.IMKEY_COMMIT;
  }

  return self;
}

// Entry stub
jscin.register_addon('Punctuations', ModPunctuations);
