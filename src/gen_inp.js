// Copyright 2011 Google Inc. All Rights Reserved.

/**
 * @fileoverview Description of this file.
 * @author kcwu@google.com (Kuang-che Wu)
 */

function copy_default(src, dst) {
  for (var key in src) {
    if (dst[key] == undefined) dst[key] = src;
  }
}

default_conf = {
  'AUTO_COMPOSE': true,
  'AUTO_UPCHAR': true,
  'AUTO_FULLUP': false,
  'SPACE_AUTOUP': false,
  'SELKEY_SHIFT': false,
  'SPACE_AUTOUP': false,
  'SPACE_RESET': true,
  'AUTO_RESET': false,
  'WILD_ENABLE': true,
  'SINMD_IN_LINE1': false,
  'END_KEY': false,
  'QPHRASE_MODE': 0,
  'DISABLE_SEL_LIST': 'none',
  'KEYSTROKE_REMAP': 'none',
  'BEEP_WRONG': true,
  'BEEP_DUPCHAR': true,
};

array30_conf = {
  'DISABLE_SEL_LIST': 'w',
  'KEYSTROKE_REMAP': 't:0xaaba;T:0xaaba;',
};
copy_default(default_conf, array30_conf);

liu_conf = {
  'AUTO_COMPOSE': true,
  'AUTO_UPCHAR': true,
  'SPACE_AUTOUP': true,
  'SELKEY_SHIFT': true,
  'SPACE_RESET': true,
};
copy_default(default_conf, liu_conf);


// init for IME, ex. Zhuyin, Array
GenInp = function(name, conf) {
  this.name = name;
  this.conf = conf;
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

  self.keystroke = function(inpinfo, keyinfo) {
    return constant.IMKEY_IGNORE;
  }
  self.show_keystroke = function(conf, simdinfo) {
    return 0;
  }
  return self;
}

function main() {
  load('constant.js');
  var liu = new GenInp('liu', liu_conf);
  var inst = liu.new_instance(inpinfo);

  var inpinfo = {};
  var keyinfo = {'key':'a'};
  var ret = inst.keystroke(inpinfo, keyinfo);
  print('ret = ' + ret);
  var keyinfo = {'key':'Space'};
  var ret = inst.keystroke(inpinfo, keyinfo);
  print('ret = ' + ret);
}

if (typeof(console) == typeof(undefined)) {
  main();
}
