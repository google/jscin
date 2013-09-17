// Copyright 2011 Google Inc. All Rights Reserved.
// Author: kcwu@google.com (Kuang-che Wu)

load('../jscin/jscin.js');
load('../jscin/lz-string.js');
load('../jscin/gen_inp2.js');
load('../jscin/cin_parser.js');
// jscin.debug = true;

var codeMap = {
    ";": "Semicolon",
    "=": "Equal",
    ",": "Comma",
    "-": "Minus",
    ".": "Period",
    "/": "Slash",
    "`": "BackQuote",
    "[": "BracketLeft",
    "]": "BracketRight",
    "\\": "Backslash",
    "'": "Quote",
    " ": "Space"
};

function simulate(inst, inpinfo, input, expect) {
  for (var i in input) {
    var digits = "0123456789";
    var alphabets = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    var code = input[i].toUpperCase();
    if (code in codeMap) {
      code = codeMap[code];
    } else if (digits.indexOf(code) >= 0)
      code = 'Digit' + code;
    else if (alphabets.indexOf(code) >= 0)
      code = 'Key' + code;
    else {
      print("Sorry, unknown input: ", code);
      return false;
    }

    var keyinfo = {type: 'keydown', key: input[i], code: code};
    // print(dump_object(keyinfo));
    var ret = inst.onKeystroke(inpinfo, keyinfo);
    print('ret=', ret, ", inpinfo: ", dump_inpinfo(inpinfo));

    // Only allow COMMIT in end of input.
    var expected_ret = ((parseInt(i) + 1 == input.length) ?
                        jscin.IMKEY_COMMIT : jscin.IMKEY_ABSORB);
    if (ret != expected_ret) {
      print("test failed: ret=", ret, ", expected: ", expected_ret);
      return false;
    }
  }

  if (inpinfo.cch == expect)
    return true;
  print("test failed: input=", input, ", expect: ", expect);
  return false;
}

function loadTableFromFile(filename) {
  var content = read(filename);
  var results = parseCin(content);
  if (!results[0]) {
    jscin.log('failed to load ' + filename + ', msg:' + results[1]);
    return;
  }
  var table_metadata = results[1].metadata;
  var table_data = results[1].data;
  var name = table_metadata.ename;
  jscin.addTable(name, table_metadata, table_data);
  return name;
}

function main() {
  var test_list = [
    {
      table: "test_ar30_gcin.cin",
      test: [
        { input: "lox ", result: "我" },
        { input: "AA3", result: "武" },
        { input: "t ", result: "的" },
        { input: "t1", result: "隨" },
        { input: "w ", result: "女" },
        { input: "w11", result: "，" },
        { input: "w22", result: "）" }
      ]
    }, {
      table: "test_ar30_xcin25.cin",
      test: [
        { input: "lox ", result: "我" },
        { input: "t ", result: "的" },
        { input: "t1", result: "隨" },
        { input: "w ", result: "女" },
        { input: "w11", result: "，" },
        { input: "w22", result: "）" },
      ]
    }, {
      table: "test_boshiamy.cin",
      test: [
        { input: "a ", result: "對" },
        { input: "a1", result: "对" },
        { input: "a2", result: "対" },
      ]
    }, {
      table: "test_dayi3p.cin",
      test: [
        { input: "= ", result: "。" },
        { input: "='", result: "，" },
        { input: "x  ", result: "水" },
        { input: "x '", result: "又" },
        { input: "x [", result: "乂" },
        { input: "ao ", result: "合" },
      ]
    }, {
      table: "test_phone.cin",
      test: [
        { input: "z ", result: "ㄈ" },
        { input: "- 1", result: "ㄦ" },
        { input: "- 2", result: "兒" },
        { input: "283", result: "打" },
        { input: "5j41", result: "住" },
        { input: "5j42", result: "著" },
      ]
    }
  ];

  var total_failure = 0;
  var total_tested = 0;
  test_list.forEach(function (test) {
    var failure = 0;
    var name = loadTableFromFile(test.table);
    jscin.reload_configuration();
    var inpinfo = {};
    var inst = jscin.create_input_method(name, inpinfo);
    test.test.forEach(function (entry) {
      total_tested++;
      if (!simulate(inst, inpinfo, entry.input, entry.result))
        failure++;
    });
    if (failure) {
      print("test " + name + " failed: " + failure + " times.");
      total_failure += failure;
    }
  });
  print("Total failures: ", total_failure, " / " , total_tested);
}

main();
