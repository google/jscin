// Copyright 2011 Google Inc. All Rights Reserved.
// Author: kcwu@google.com (Kuang-che Wu)

load('../jscin/jscin.js');
load('../jscin/base_inp.js');
load('../jscin/gen_inp2.js');
load('../jscin/cin_parser.js');
// jscin.debug = true;

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

function build_reverse_map(from) {
  var to = {};
  for (var k in from) {
    if (from[k] in to)
      continue;
    to[from[k]] = k;
  }
  return to;
}

function simulate(inst, inpinfo, input, result, expects) {
  var committed = '';
  // FIX(hungte) jscin.kImeKeyCodeTable is removed.
  var c2code = build_reverse_map(jscin.kImeKeyCodeTable);
  for (var i in input) {
    var code = c2code[input[i].toUpperCase()] || '';
    if (code == '') {
      print("Sorry, unknown input: ", input[i]);
      return false;
    }

    var keyinfo = {type: 'keydown', key: input[i], code: code};
    // print(dump_object(keyinfo));
    var ret = inst.keystroke(inpinfo, keyinfo);
    print('ret=', ret, ", inpinfo: ", dump_inpinfo(inpinfo));

    var expect;
    if (!expects || expects[i] == undefined) {
      // By default, only allow COMMIT in end of input.
      expect = { ret: parseInt(i)+1 == input.length ?
          jscin.IMKEY_COMMIT  : jscin.IMKEY_ABSORB};
    } else {
      expect = expects[i];
    }

    var ok = true;
    var to_check = ['keystroke', 'mcch', 'cch', 'selkey'];
    to_check.forEach(function (name) {
      if (expect[name] != undefined) {
        if (inpinfo[name] != expect[name]) {
          print('test failed: ', name, '=', inpinfo[name], ', expected: ',
                expect[name]);
          ok = false;
        }
      }
    });
    if (expect.ret != undefined && ret != expect.ret) {
      print("test failed: ret=", ret, ", expected: ", expect.ret);
      ok = false;
    }
    if (!ok) {
      return false;
    }
    if (ret == jscin.IMKEY_COMMIT)
      committed += inpinfo.cch;
  }

  if (committed == result)
    return true;
  print("test failed: input=", input, ", expect: ", result);
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
        { input: "aa3", result: "武" },
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
        { input: "a ", result: "對", 0: {selkey: ' 1234567890'} },
        { input: "o ", result: "○", 0: {mcch: '○〇'} },
        { input: "o1", result: "〇" },
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
        { input: "283", result: "打" },  // single candidate
        { input: "8283", result: "打", 1: {keystroke: 'ㄉㄚ'} },  // key group
        { input: "5j41", result: "住" },
        { input: "5j42", result: "著" },
        { input: "5j4  5", result: "莇" },  // candidate in 3rd page
        { input: "5j4j541", result: "住住",
          3: {'cch': '住', ret: jscin.IMKEY_COMMIT}},
        { input: "-  ", result: "ㄦ" },  // space to commit if few candidate
        { input: "5j4    2", result: "著" },  // space to next page if more than one page
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
      if (!simulate(inst, inpinfo, entry.input, entry.result, entry))
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
