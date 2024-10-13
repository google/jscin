// Copyright 2011 Google Inc. All Rights Reserved.

/**
 * @fileoverview The console loader for interactive testing without browser.
 * @author hungte@google.com (Hung-Te Lin)
 */

// Equivelant to croscin.html (extension entry page).
jscin_url = '../jscin/'
load(jscin_url + 'jscin.js');
load(jscin_url + 'cin_parser.js');
load(jscin_url + 'base_inp.js');
load(jscin_url + 'gen_inp2.js');

var imctx = {};
var im = null;

function LoadTable(table_url) {
  var table_metadata = jscin.readLocalStorage(jscin.kTableMetadataKey, {});
  print("table_url: [" + table_url + "]");
  var cin = parseCin(read(table_url));
  if (!cin[0]) {
    print("ERROR: Invalid table: " + table_url);
    return;
  }
  var table_content = cin[1].data;
  var ename = table_content['ename'];
  table_metadata[ename] = table_content;
  jscin.writeLocalStorage(jscin.kTableDataKeyPrefix + ename, table_content);
  jscin.writeLocalStorage(jscin.kTableMetadataKey, table_metadata);
  jscin.reload_configuration();
  return ename;
}

function ActivateInputMethod(name) {
  if (name in jscin.input_methods) {
    imctx = {};
    im = jscin.create_input_method(name, imctx);
  } else {
    print("ActivateInputMethod: Invalid item: " + name);
  }
}

function Simulate(ev) {
  // TODO replace me with stub for function we're going to test.
  print("  > Simulate: " + ev);
  var ret = im.keystroke(imctx, ev);
  switch (ret) {
    case jscin.IMKEY_COMMIT:
      print("Simulate result: IMKEY_COMMIT", imctx.cch);
      break;
    case jscin.IMKEY_ABSORB:
      print("Simulate result: IMKEY_ABSORB");
      break;
    case jscin.IMKEY_IGNORE:
      print("Simulate result: IMKEY_IGNORE");
      break;
  }
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

function create_key_event(ch, keyname) {
  // http://www.w3.org/TR/DOM-Level-3-Events/#events-KeyboardEvent
  var ev = { 'type': 'keydown' };
  // FIX(hungte) jscin.kImeKeyCodeTable is removed.
  var c2code = build_reverse_map(jscin.kImeKeyCodeTable);

  if (keyname != null)
    ev.code = keyname;
  else if (ch == '\u001B')
    ch = ev.code = 'Esc';
  else if (ch == '\u0009')
    ch = ev.code = 'Tab';
  else if (ch == '\u007F')
    ch = ev.code = 'Delete';
  else
    ev.code = c2code[ch.toUpperCase()] || '';

  if (ev.code == '') {
    print("Sorry, unknown input: ", ch);
  }
  ev.key = ch;

  return ev;
}

function console_main(argv) {
  // You must execute this program with SpiderMonkey jsshell or V8 "d8".
  print("JSCIN Eumlator\n");

  var im_url = "";
  if (argv.length > 0) {
    for (var i in argv) {
      im_name = LoadTable(argv[i]);
    }
  } else {
    print("No input table file assigned. \n" +
          "You can specify that in command line (d8 console.js -- FILE).\n");
    write("Input table file to load: ");
    im_name = LoadTable(readline());
  }
  if (!im_name) {
    print("Failed to load table. Abort.");
    return;
  }
  ActivateInputMethod(im_name);
  print("To simulate simple keystrokes, type them all and then ENTER.");
  print("To simulate special keys, press Ctrk-K first and type key code name.");
  write("> ");

  while (str = readline()) {
    print("# Raw input: [" + str + "]");
    var keycode = null;
    if (str.charCodeAt(0) == 11) {
      keycode = str.substring(1);
      str = ' ';
    }
    for (i in str) {
      ev = create_key_event(str[i], keycode);
      print("# Simulating: " + ev.key);
      Simulate(ev);
    }
    write("> ");
  }
}

console_main(arguments);
