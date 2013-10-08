// Copyright 2013 Google Inc. All Rights Reserved.

/**
 * @fileoverview JSCIN external extension Nacl module background script.
 * @author hungte@google.com (Hung-Te Lin)
 */

// TODO(hungte) Detect JSCIN host and register automatically.

var _debug = false;

document.addEventListener( 'readystatechange', function() {
  if (document.readyState !== 'complete')
    return;

  // Keys to communicate with Nacl (nacl.cc)
  var kNaclKeyPrefix = "key:";
  var kNaclDebugPrefix = "debug:";
  var kNaclContextPrefix = "context:";
  var kMetadataURL = "jscin/im.json";

  var nacl = document.getElementById('nacl');
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
    if (resp.indexOf(kNaclContextPrefix) == 0) {
      var ctx = JSON.parse(resp.substr(kNaclContextPrefix.length));
      debug("send Jscin IM response for", ctx);
      jscin.external.send_keystroke_response(true, ctx);
      return;
    }
    debug("unknown response from Nacl:", resp);
  }

  // Register my metadata.
  var ime_id = jscin.external.register(chrome.extension.getURL(kMetadataURL));

  // TODO(hungte) We should also send id as part of the message.
  // TODO(hungte) Check if ime_id is invalid (no IME host found).
  jscin.external.init_im(ime_id, {
    keystroke: function (context, ev) {
      // TODO(hungte) How to decide using .key or .code?
      var k = ev.key;
      debug("received jscin/keystroke:", k);
      nacl.postMessage(PackNaclKeyCommand(k));
    }
  });

  nacl.addEventListener('message', function (ev) {
    debug("Handle Nacl response", ev.data);
    HandleNaclResponse(ev.data);
  }, false);
});
