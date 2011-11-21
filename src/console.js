// Copyright 2011 Google Inc. All Rights Reserved.

/**
 * @fileoverview The console loader for interactive testing without browser.
 * @author hungte@google.com (Hung-Te Lin)
 */

function Simulate(ev) {
  // TODO replace me with stub for function we're going to test.
  print("  > Simulate: " + ev);
}

function create_key_event(ch, keyname) {
  // http://www.w3.org/TR/DOM-Level-3-Events/#events-KeyboardEvent
  var ev = {
    'type': 'keydown',
  }
  if (keyname != null)
    ch = keyname;
  else if (ch == '\u001B')
    ch = 'Esc';
  else if (ch == '\u0009')
    ch = 'Tab';
  else if (ch == '\u007F')
    ch = 'Del';

  ev.key = ch;
  return ev;
}

function console_main() {
  // You must execute this program with SpiderMonkey jsshell or V8 "d8".
  print("Started CIN emulation. Please enter key strokes then ENTER.");
  print("To simulate special keys, press Ctrl-K first then type key name:");

  while (str = readline()) {
    print("# Raw input: [" + str + "]");
    keyname = null
    if (str.charCodeAt(0) == 11) {
      keyname = str.substring(1);
      str = ' ';

    }
    for (i in str) {
      ev = create_key_event(str[i], keyname);
      print("# Simulating: " + ev.key);
      Simulate(ev);
    }
  }
}

console_main();
