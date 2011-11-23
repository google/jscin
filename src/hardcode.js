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
  'DISABLE_SEL_LIST': '',
  'KEYSTROKE_REMAP': 'none',
  'BEEP_WRONG': true,
  'BEEP_DUPCHAR': true,
};

array30_conf = {
  'DISABLE_SEL_LIST': 'w',
  'KEYSTROKE_REMAP': {'t':'\u7684'},  // 的
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

liu_cin_header = {
  'keyname': {
    'a': 'A',
    'b': 'B',
    'c': 'C',
    'd': 'D',
    'e': 'E',
    'f': 'F',
    'g': 'G',
    'h': 'H',
    'i': 'I',
    'j': 'J',
    'k': 'K',
    'l': 'L',
    'm': 'M',
    'n': 'N',
    'o': 'O',
    'p': 'P',
    'q': 'Q',
    'r': 'R',
    's': 'S',
    't': 'T',
    'u': 'U',
    'v': 'V',
    'w': 'W',
    'x': 'X',
    'y': 'Y',
    'z': 'Z',
  },
  'selkey': '1234567890',
  'endkey': '',
  'max_keystroke': 4,
};
liu_table = {
  'a': '\u5c0d',  // 對
  'c': '\u4e03',  // 七
  'ci': '\u4e2d',  // 中
  'w': '\u4e94',  // 五
  'wx': '\u6587',  // 文
  'l': '\u516d',  // 六
  'ln': '\u4f86\u8944\u8012',  // 來襄耒
};

// register input methods into system.
jscin.register_input_method('array30', 'GenInp', array30_conf);
jscin.register_input_method('liu', 'GenInp', liu_conf);
