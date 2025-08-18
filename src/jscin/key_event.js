// Copyright 2024 Google Inc. All Rights Reserved.
// Author: Hung-Te Lin <hungte@gmail.com>

// To create KeyboardEvent-like events.
// http://www.w3.org/TR/DOM-Level-3-Events/#events-KeyboardEvent

// Warning: The chrome.input.ime on CrOS is using a different mapping that
// code: 'Escape' => key: 'Esc',
// code: 'Array{Left,Up,Right,Down}' => key: '{Left,Up,Right,Down}'.

/* A mapping table to find KeyboardEvent.code from KeyboardEvent.key. */
export const KEY_TO_CODE = {
  "Backspace":		"Backspace",
  "Tab":		"Tab",
  "\t":		        "Tab",
  "Enter":		"Enter",
  "Shift":		"ShiftLeft",
  "Control":		"ControlLeft",
  "Alt":		"AltLeft",
  "Pause":		"Pause",
  "CapsLock":		"CapsLock",
  "Escape":		"Escape",
  "Esc":		"Escape",       // chrome.input.ime.
  " ":		        "Space",
  "PageUp":		"PageUp",
  "PageDown":		"PageDown",
  "End":		"End",
  "Home":		"Home",
  "ArrowLeft":		"ArrowLeft",
  "ArrowUp":		"ArrowUp",
  "ArrowRight":		"ArrowRight",
  "ArrowDown":		"ArrowDown",
  "Left":		"ArrowLeft",    // chrome.input.ime.
  "Up":	        	"ArrowUp",      // chrome.input.ime.
  "Right":		"ArrowRight",   // chrome.input.ime.
  "Down":		"ArrowDown",    // chrome.input.ime.
  "Insert":		"Insert",
  "Delete":		"Delete",
  "0":		        "Digit0",
  "1":		        "Digit1",
  "2":		        "Digit2",
  "3":		        "Digit3",
  "4":		        "Digit4",
  "5":		        "Digit5",
  "6":		        "Digit6",
  "7":		        "Digit7",
  "8":		        "Digit8",
  "9":		        "Digit9",
  "a":		        "KeyA",
  "b":		        "KeyB",
  "c":		        "KeyC",
  "d":		        "KeyD",
  "e":		        "KeyE",
  "f":		        "KeyF",
  "g":		        "KeyG",
  "h":		        "KeyH",
  "i":		        "KeyI",
  "j":		        "KeyJ",
  "k":		        "KeyK",
  "l":		        "KeyL",
  "m":		        "KeyM",
  "n":		        "KeyN",
  "o":		        "KeyO",
  "p":		        "KeyP",
  "q":		        "KeyQ",
  "r":		        "KeyR",
  "s":		        "KeyS",
  "t":		        "KeyT",
  "u":		        "KeyU",
  "v":		        "KeyV",
  "w":		        "KeyW",
  "x":		        "KeyX",
  "y":		        "KeyY",
  "z":		        "KeyZ",
  "F1":		        "F1",
  "F2":		        "F2",
  "F3":		        "F3",
  "F4":		        "F4",
  "F5":		        "F5",
  "F6":		        "F6",
  "F7":		        "F7",
  "F8":		        "F8",
  "F9":		        "F9",
  "F10":		"F10",
  "F11":		"F11",
  "F12":		"F12",
  "NumLock":		"NumLock",
  "ScrollLock":         "ScrollLock",
  ";":                  "Semicolon",
  "=":                  "Equal",
  ",":                  "Comma",
  "-":                  "Minus",
  ".":                  "Period",
  "/":                  "Slash",
  "`":                  "BackQuote",
  "[":                  "BracketLeft",
  "/":                  "Backslash",
  "]":                  "BracketRight",
  "'":                  "Quote",
};

// Converts KeyboardEvent.code to KeyboardEvent.key, regardless of shift
// modifier.  This only includes en-US layout common keys that we'd usually use
// in CJK IMs.
export const UNSHIFT_MAP = {
  "Digit0":		"0",
  "Digit1":		"1",
  "Digit2":		"2",
  "Digit3":		"3",
  "Digit4":		"4",
  "Digit5":		"5",
  "Digit6":		"6",
  "Digit7":		"7",
  "Digit8":		"8",
  "Digit9":		"9",
  "KeyA":		"a",
  "KeyB":		"b",
  "KeyC":		"c",
  "KeyD":		"d",
  "KeyE":		"e",
  "KeyF":		"f",
  "KeyG":		"g",
  "KeyH":		"h",
  "KeyI":		"i",
  "KeyJ":		"j",
  "KeyK":		"k",
  "KeyL":		"l",
  "KeyM":		"m",
  "KeyN":		"n",
  "KeyO":		"o",
  "KeyP":		"p",
  "KeyQ":		"q",
  "KeyR":		"r",
  "KeyS":		"s",
  "KeyT":		"t",
  "KeyU":		"u",
  "KeyV":		"v",
  "KeyW":		"w",
  "KeyX":		"x",
  "KeyY":		"y",
  "KeyZ":		"z",
  "Semicolon":		";",
  "Equal":		"=",
  "Comma":		",",
  "Minus":		"-",
  "Period":		".",
  "Slash":		"/",
  "BackQuote":		"`",
  "BracketLeft":	"[",
  "BracketRight":	"]",
  "Backslash":		"\\",
  "Quote":		"'",
};

// A simplified version of KeyboardEvent, mostly for input methods to use.
export class KeyEvent {
  constructor(key, code, type='keydown') {
    if (!code)
      code = KEY_TO_CODE[key] || key;

    this.type = type;
    this.key = key;
    this.code = code;

    this.ctrlKey = false;
    this.altKey = false;
    this.shiftKey = false;
    this.metaKey = false;
  }
}

// Returns the KeyboardEvent.key regardless of ev.shiftKey state.
export function getUnshiftedKey(ev) {
  return UNSHIFT_MAP[ev.code] || ev.key;
}

export function normalizeKey(key) {
  // Normalize between CrOS KeyEvent.key and W3C KeyboardEvent.key
  const mapping = {
    'Esc':   'Escape',
    'Up':    'ArrowUp',
    'Down':  'ArrowDown',
    'Left':  'ArrowLeft',
    'Right': 'ArrowRight',
  };

  return mapping[key] || key;
}

// A short cut to check Ctrl/Alt/Meta modifiers (no Shift).
export function hasCtrlAltMeta(ev) {
  return ev.ctrlKey || ev.altKey || ev.metaKey;
}
