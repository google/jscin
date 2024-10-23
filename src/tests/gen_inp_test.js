// Copyright 2011 Google Inc. All Rights Reserved.
// Author: kcwu@google.com (Kuang-che Wu)

import {parseCin} from '../jscin/cin_parser.js';
import {jscin} from '../jscin/jscin.js';
import {KeyEvent} from '../jscin/key_event.js';

import '../jscin/base_inp.js';
import '../jscin/gen_inp2.js';

import fs from 'node:fs';

let print = console.log
jscin.debug = true;

function simulate(inst, inpinfo, input, result, expects) {
  let committed = '';

  for (let i in input) {
    let keyinfo = new KeyEvent(input[i]);
    let ret = inst.keystroke(inpinfo, keyinfo);
    print('ret=', ret, ", inpinfo: ", inpinfo);

    let expect;
    if (!expects || expects[i] == undefined) {
      // By default, only allow COMMIT in end of input.
      expect = { ret: parseInt(i)+1 == input.length ?
          jscin.IMKEY_COMMIT  : jscin.IMKEY_ABSORB};
    } else {
      expect = expects[i];
    }

    let ok = true;
    let to_check = ['keystroke', 'mcch', 'cch', 'selkey'];
    for (let name of to_check) {
      if (expect[name] != undefined) {
        if (inpinfo[name] != expect[name]) {
          print('test failed: ', name, '=', inpinfo[name], ', expected: ',
                expect[name]);
          ok = false;
        }
      }
    };
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
  const content = fs.readFileSync(filename, 'utf8');
  let [success, result] = parseCin(content);
  if (!success) {
    jscin.log('failed to load:', filename, 'msg:', result);
    return;
  }
  let table_metadata = result.metadata;
  let table_data = result.data;
  let name = table_metadata.ename;
  jscin.addTable(name, table_metadata, table_data);
  return name;
}

async function main() {
  let test_list = [
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

  let total_failure = 0;
  let total_tested = 0;
  for (let test of test_list) {
    let failure = 0;
    let name = loadTableFromFile(test.table);
    jscin.reload_configuration();
    let inpinfo = {};
    let inst = jscin.create_input_method(name, inpinfo);
    for (let entry of test.test) {
      total_tested++;
      if (!simulate(inst, inpinfo, entry.input, entry.result, entry))
        failure++;
    };
    if (failure) {
      print(`test ${name} failed: ${failure} times.`);
      total_failure += failure;
    }
  };
  print("Total failures: ", total_failure, " / " , total_tested);
}

await main();
