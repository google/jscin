// Copyright 2011 Google Inc. All Rights Reserved.

/**
 * @fileoverview Description of this file.
 * @author kcwu@google.com (Kuang-che Wu)
 */

array30_data = {
  'DISABLE_SEL_LIST': 'w',
  'KEYSTROKE_REMAP': {'t':'\u7684'},  // 的
  'keyname': {
    'a': '1-',
    'b': '5v',
    'c': '3v',
    'd': '3-',
    'e': '3^',
    'f': '4-',
    'g': '5-',
    'h': '6-',
    'i': '8^',
    'j': '7-',
    'k': '8-',
    'l': '9-',
    'm': '7v',
    'n': '6v',
    'o': '9^',
    'p': '0^',
    'q': '1^',
    'r': '4^',
    's': '2-',
    't': '5^',
    'u': '7^',
    'v': '4v',
    'w': '2^',
    'x': '2v',
    'y': '6^',
    'z': '1v',
  },
  'selkey': '1234567890',
  'endkey': '',
  'max_keystroke': 4,
  'chardef': {
    'a': '\u4e00\u5230\u807d\u73fe\u653f\u5f04\u5169\u800c\u9762\u8981',
    'ab': '\u53d4',  // 叔
  },
};

liu_data = {
  'AUTO_COMPOSE': true,
  'AUTO_UPCHAR': true,
  'SPACE_AUTOUP': true,
  'SELKEY_SHIFT': true,
  'SPACE_RESET': true,
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
  'chardef': {
    'a': '\u5c0d',  // 對
    'c': '\u4e03',  // 七
    'ci': '\u4e2d',  // 中
    'w': '\u4e94',  // 五
    'wx': '\u6587',  // 文
    'l': '\u516d',  // 六
    'ln': '\u4f86\u8944\u8012',  // 來襄耒
  },
};

var kTableMetadataKey = "table_metadata";
var kTableDataKeyPrefix = "table_data-";
var kDefaultCinTableKey = "default_cin_table";

var kPredefineArray30 = 'predefined-array30';
var kPredefineLiu = 'predefined-liu';

function init_predefined() {
  var table_metadata = jscin.readLocalStorage(kTableMetadataKey, {});
  table_metadata[kPredefineArray30] = {'ename': 'builtin-array30',
                                       'cname': 'Array',
                                       'builtin': true};
  table_metadata[kPredefineLiu] = {'ename': 'builtin-liu',
                                   'cname': 'Boshiamy',
                                   'builtin': true};
  jscin.writeLocalStorage(kTableMetadataKey, table_metadata);

  jscin.writeLocalStorage(kTableDataKeyPrefix + kPredefineArray30, array30_data);
  jscin.writeLocalStorage(kTableDataKeyPrefix + kPredefineLiu, liu_data);
}

init_predefined();

// register input methods into system.
function register_first() {
  jscin.set_default_input_method(jscin.readLocalStorage(kDefaultCinTableKey));

  var table_metadata = jscin.readLocalStorage(kTableMetadataKey, {});
  for (var name in table_metadata) {
    // TODO(hungte) support more modules in future.
    jscin.register_input_method( name, 'GenInp', table_metadata[name].cname);
  }
}

register_first();
