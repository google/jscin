// Copyright 2011 Google Inc. All Rights Reserved.

/**
 * @fileoverview The console loader for interactive testing without browser.
 * @author hungte@google.com (Hung-Te Lin)
 */

import {jscin} from "../jscin/jscin.js";
import {KeyEvent} from "../jscin/key_event.js";
import "../jscin/gen_inp2.js";

import fs from 'node:fs';
import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

var imctx = {};
var im = null;

const print = console.log;
const write = console.log;

async function loadTable(url) {
  let [name] = url.split('/').pop().split('.');
  return jscin.saveTable(name, fs.readFileSync(url, 'utf8'), url, {});
}

function Simulate(ev) {
  // TODO replace me with stub for function we're going to test.
  print("  > Simulate: ", ev);
  let ret = im.keystroke(imctx, ev);
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

async function console_main(argv) {
  // You must execute this program with node.js.
  print("JsCIN Emulator\n");
  const rl = readline.createInterface({ input, output });

  let im_url = "";
  let im_name;

  if (argv.length > 0) {
    for (let fn of argv) {
      print("Loading:", fn);
      im_name = await loadTable(fn);
    }
  } else {
    print("No input table file assigned. Try '../tables/ar30.cin'.\n",
          "You can specify that in command line (d8 console.js -- FILE).\n");
    const answer = await rl.question("Input table file to load: ");
    im_name = await loadTable(answer);
  }
  if (!im_name) {
    print("Failed to load table. Abort.");
    return;
  }
  imctx = {}
  im = await jscin.activateInputMethod(im_name, imctx);

  print("To simulate simple keystrokes, type them all and then ENTER.");
  print("To simulate special keys, press Tab first and type a key code.");

  while (true) {
    const str = await rl.question("> ");
    print(`#Raw input [${str}]`);
    let keycode = null;
    if (str.charCodeAt(0) == '\t') {
      keycode = str.substring(1);
      str = ' ';
    }
    for (let i in str) {
      let ev = new KeyEvent(str[i], keycode);
      print("# Simulating:", ev.key, '[', ev.code, ']');
      Simulate(ev);
    }
    write("> ");
  }
}

console_main(process.argv.slice(2));
