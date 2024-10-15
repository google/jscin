// Copyright 2011 Google Inc. All Rights Reserved.

/**
 * @fileoverview The console loader for interactive testing without browser.
 * @author hungte@google.com (Hung-Te Lin)
 */

import {jscin} from "../jscin/jscin.js";
import {parseCin} from "../jscin/cin_parser.js";
import "../jscin/base_inp.js";
import "../jscin/gen_inp2.js";

import fs from 'node:fs';
import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

var imctx = {};
var im = null;

function CreateKeyEvent(key) {
  // http://www.w3.org/TR/DOM-Level-3-Events/#events-KeyboardEvent
  const KeyToCode = {
    "Backspace":"Backspace",
    "Tab":	"Tab",
    "Enter":	"Enter",
    "Shift":    "ShiftLeft",
    "Control":  "ControlLeft",
    "Alt":	"AltLeft",
    "Pause":	"Pause",
    "CapsLock":	"CapsLock",
    "Escape":	"Escape",
    " ":	"Space",
    "PageUp":	"PageUp",
    "PageDown":	"PageDown",
    "End":	"End",
    "Home":	"Home",
    "ArrowLeft":	"ArrowLeft",
    "ArrowUp":	"ArrowUp",
    "ArrowRight":	"ArrowRight",
    "ArrowDown":	"ArrowDown",
    "Insert":	"Insert",
    "Delete":	"Delete",
    "0":	"Digit0",
    "1":	"Digit1",
    "2":	"Digit2",
    "3":	"Digit3",
    "4":	"Digit4",
    "5":	"Digit5",
    "6":	"Digit6",
    "7":	"Digit7",
    "8":	"Digit8",
    "9":	"Digit9",
    "a":	"KeyA",
    "b":	"KeyB",
    "c":	"KeyC",
    "d":	"KeyD",
    "e":	"KeyE",
    "f":	"KeyF",
    "g":	"KeyG",
    "h":	"KeyH",
    "i":	"KeyI",
    "j":	"KeyJ",
    "k":	"KeyK",
    "l":	"KeyL",
    "m":	"KeyM",
    "n":	"KeyN",
    "o":	"KeyO",
    "p":	"KeyP",
    "q":	"KeyQ",
    "r":	"KeyR",
    "s":	"KeyS",
    "t":	"KeyT",
    "u":	"KeyU",
    "v":	"KeyV",
    "w":	"KeyW",
    "x":	"KeyX",
    "y":	"KeyY",
    "z":	"KeyZ",
    "F1":	"F1",
    "F2":	"F2",
    "F3":	"F3",
    "F4":	"F4",
    "F5":	"F5",
    "F6":	"F6",
    "F7":	"F7",
    "F8":	"F8",
    "F9":	"F9",
    "F10":	"F10",
    "F11":	"F11",
    "F12":	"F12",
    "NumLock":	"NumLock",
    "ScrollLock":	"ScrollLock",
    ";":	"Semicolon",
    "=":	"Equal",
    ",":	"Comma",
    "-":	"Minus",
    ".":	"Period",
    "/":	"Slash",
    "`":	"BackQuote",
    "[":	"BracketLeft",
    "/":	"Backslash",
    "]":	"BracketRight",
    "'":        "Quote",
  };

  let code = key;
  if (code in KeyToCode)
    code = KeyToCode[code];
  return {
    type: "keydown",
    key: key,
    code: code,
  };
}

const print = console.log;
const write = console.log;

function LoadTable(table_url) {
  let table_metadata = jscin.readLocalStorage(jscin.kTableMetadataKey, {});
  print("table_url:", table_url);
  let [result, parsed]  = parseCin(fs.readFileSync(table_url, 'utf8'));
  if (!result) {
    print("ERROR: Invalid table:", table_url);
    return;
  }
  let {metadata, data: table_content} = parsed;
  let ename = table_content['ename'];
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
    print("ActivateInputMethod: Invalid item:", name);
  }
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
      im_name = LoadTable(fn);
    }
  } else {
    print("No input table file assigned. \n",
          "You can specify that in command line (d8 console.js -- FILE).\n");
    const answer = await rl.question("Input table file to load: ");
    im_name = LoadTable(answer);
  }
  if (!im_name) {
    print("Failed to load table. Abort.");
    return;
  }
  ActivateInputMethod(im_name);

  print("To simulate simple keystrokes, type them all and then ENTER.");
  print("To simulate special keys, press Tab first and type a key code.");

  while (true) {
    const str = await rl.question("> ");
    print(`#Raw inpu [${str}]`);
    let keycode = null;
    if (str.charCodeAt(0) == '\t') {
      keycode = str.substring(1);
      str = ' ';
    }
    for (let i in str) {
      let ev = CreateKeyEvent(str[i], keycode);
      print("# Simulating:", ev.key, '[', ev.code, ']');
      Simulate(ev);
    }
    write("> ");
  }
}

console_main(process.argv.slice(2));
