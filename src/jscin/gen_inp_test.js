// Copyright 2011 Google Inc. All Rights Reserved.
// Author: kcwu@google.com (Kuang-che Wu)

load('jscin.js');
load('gen_inp.js');
load('cin_parser.js');

function simulate(inst, inpinfo, input) {
  for (var i in input) {
    var keyinfo = {'key': input[i]};
    var ret = inst.onKeystroke(inpinfo, keyinfo);
    print('ret = ' + ret);
    print(dump_inpinfo(inpinfo));
    print('');
  }
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

  var name = loadTableFromFile('../tables/array30.cin');
  jscin.reload_configuration();

  var inpinfo = {};
  var inst = jscin.create_input_method(name, inpinfo);

  simulate(inst, inpinfo, ['a', ' ']);
  //simulate(inst, inpinfo, ['a', ' ', '1']);
  //simulate(inst, inpinfo, ['l', 'n', ' ']);
  //simulate(inst, inpinfo, ['l', 'n', '1']);
}


main();
