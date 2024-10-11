// Copyright 2013 Google Inc. All Rights Reserved.

/**
 * @fileoverview Convert Browser Events to IME Events.
 * @author hungte@google.com (Hung-Te Lin)
 */

import { jscin } from "../jscin/jscin.js";
import { ChromeExtensionIPC } from "./ipc.js";

export var ImeEvent = {
  // The KeyboardEvent by browser uses "JavaScript Key Code" and is different
  // from Chrome Extension key names. Ref:
  // http://www.cambiaresearch.com/articles/15/javascript-char-codes-key-codes
  // http://src.chromium.org/svn/trunk/src/chromeos/ime/ibus_keymap.cc
  JsKeyCodeTable: {
    8: "Backspace",
    9: "Tab",
    13: "Enter",
    16: "ShiftLeft",
    17: "ControlLeft",
    18: "AltLeft",
    19: "Pause",
    20: "CapsLock",
    27: "Esc",
    32: "Space",
    33: "PageUp",
    34: "PageDown",
    35: "End",
    36: "Home",
    37: "ArrowLeft",
    38: "ArrowUp",
    39: "ArrowRight",
    40: "ArrowDown",
    45: "Insert",
    46: "Delete",
    48: "Digit0",
    49: "Digit1",
    50: "Digit2",
    51: "Digit3",
    52: "Digit4",
    53: "Digit5",
    54: "Digit6",
    55: "Digit7",
    56: "Digit8",
    57: "Digit9",
    65: "KeyA",
    66: "KeyB",
    67: "KeyC",
    68: "KeyD",
    69: "KeyE",
    70: "KeyF",
    71: "KeyG",
    72: "KeyH",
    73: "KeyI",
    74: "KeyJ",
    75: "KeyK",
    76: "KeyL",
    77: "KeyM",
    78: "KeyN",
    79: "KeyO",
    80: "KeyP",
    81: "KeyQ",
    82: "KeyR",
    83: "KeyS",
    84: "KeyT",
    85: "KeyU",
    86: "KeyV",
    87: "KeyW",
    88: "KeyX",
    89: "KeyY",
    90: "KeyZ",
    96: "Numpad0",
    97: "Numpad1",
    98: "Numpad2",
    99: "Numpad3",
    100: "Numpad4",
    101: "Numpad5",
    102: "Numpad6",
    103: "Numpad7",
    104: "Numpad8",
    105: "Numpad9",
    106: "NumpadMultiply",
    107: "NumpadAdd",
    109: "NumpadSubtract",
    110: "NumpadDecimal",
    111: "NumpadDivide",
    112: "F1",
    113: "F2",
    114: "F3",
    115: "F4",
    116: "F5",
    117: "F6",
    118: "F7",
    119: "F8",
    120: "F9",
    121: "F10",
    122: "F11",
    123: "F12",
    144: "NumLock",
    145: "ScrollLock",
    186: "Semicolon",
    187: "Equal",
    188: "Comma",
    189: "Minus",
    190: "Period",
    191: "Slash",
    192: "BackQuote",
    219: "BracketLeft",
    220: "Backslash",
    221: "BracketRight",
    222: "Quote"
  },

  JsKeyCode2ImeKeyCode: function (k) {
    return this.JsKeyCodeTable[k] || "";
  },

  ImeKeyEvent: function(ev) {
    // Converts a KeyboardEvent to chrome.input.ime KeyboardEvent.
    // The real W3C KeyboardEvent is slightly different from Chrome Extension
    // input API, so let's make a mini implementation.
    var code = this.JsKeyCode2ImeKeyCode(ev.keyCode);
    var key = jscin.get_key_val(code);

    if (key.length == 1) {
      if (ev.shiftKey) {
        var shift_map = '~!@#$%^&*()_+{}:"<>?|';
        var char_map =  "`1234567890-=[];',./\\";
        var index = char_map.indexOf(key);
        if (index >= 0)
          key = shift_map[index];
      } else {
        if (key >= 'A' && key <= 'Z')
          key = key.toLowerCase();
      }
    }

    return {
      altKey: ev.altKey,
      ctrlKey: ev.ctrlKey,
      shiftKey: ev.shiftKey,
      type: ev.type,
      code: code,
      key: key
    };
  },
};
