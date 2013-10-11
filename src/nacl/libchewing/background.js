// Copyright 2013 Google Inc. All Rights Reserved.

/**
 * @fileoverview JSCIN external extension Nacl module background script.
 * @author hungte@google.com (Hung-Te Lin)
 */

var _debug = false;
var nodeNacl = null;

// Keys to communicate with Nacl (nacl.cc)
var kNaclKeyPrefix = "key:";
var kNaclLayoutPrefix = "layout:";
var kNaclDebugPrefix = "debug:";
var kNaclContextPrefix = "context:";
var kMetadataURL = "jscin.ext/im.json";
var kPrefKeyboardLayout = "chewingKeyboardLayout";

var currentLayout = localStorage[kPrefKeyboardLayout] || "KB_DEFAULT";

function SetKeyboardLayout(layout) {
  nodeNacl.postMessage(kNaclLayoutPrefix + layout);
  localStorage[kPrefKeyboardLayout] = layout;
}

function GetKeyboardLayout() {
  return currentLayout;
}

document.addEventListener( 'readystatechange', function() {
  if (document.readyState !== 'complete')
    return;

  nodeNacl = document.getElementById('nacl');
  var self = {};

  function warn() {
    console.log.apply(console, arguments);
  }

  function debug() {
    if (!_debug)
      return;
    warn.apply(null, arguments);
  }

  function PackNaclKeyCommand(key) {
    return kNaclKeyPrefix + key;
  }

  function HandleNaclResponse(resp) {
    if (resp.indexOf(kNaclDebugPrefix) == 0) {
      debug(resp.substr(kNaclDebugPrefix.length));
      return;
    }
    if (resp.indexOf(kNaclLayoutPrefix) == 0) {
      var layout = JSON.parse(resp.substr(kNaclLayoutPrefix.length));
      debug("keyboard layout", layout);
      currentLayout = layout;
      return;
    }
    if (resp.indexOf(kNaclContextPrefix) == 0) {
      var ctx = JSON.parse(resp.substr(kNaclContextPrefix.length));
      debug("send Jscin IM response for", ctx);
      jscin.external.send_keystroke_response(true, ctx);
      return;
    }
    debug("unknown response from Nacl:", resp);
  }

  SetKeyboardLayout(currentLayout);

  // Register my metadata.
  var ime_id = jscin.external.register(chrome.extension.getURL(kMetadataURL));

  // TODO(hungte) We should also send id as part of the message.
  // TODO(hungte) Check if ime_id is invalid (no IME host found).
  jscin.external.init_im(ime_id, {
    keystroke: function (context, ev) {
      // TODO(hungte) How to decide using .key or .code?
      var k = ev.key;
      debug("received jscin/keystroke:", k);
      nodeNacl.postMessage(PackNaclKeyCommand(k));
    }
  });

  nodeNacl.addEventListener('message', function (ev) {
    debug("Handle Nacl response", ev.data);
    HandleNaclResponse(ev.data);
  }, false);
});
