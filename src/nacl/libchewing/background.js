// Copyright 2013 Google Inc. All Rights Reserved.

/**
 * @fileoverview JSCIN external extension Nacl module background script.
 * @author hungte@google.com (Hung-Te Lin)
 */

// TODO(hungte) Detect JSCIN host and register automatically.

var _debug = true;

document.addEventListener( 'readystatechange', function() {
  if (document.readyState !== 'complete')
    return;

  // Keys to communicate with Nacl (nacl.cc)
  var kNaclKeyPrefix = "key:";
  var kNaclDebugPrefix = "debug:";
  var kNaclContextPrefix = "context:";

  // Jscin IM protocol v1: (jscin/crext_inip.js)
  //  jscin->im: {type: 'jscin_im_v1', command: <command>, args: <args>}
  //  im->jscin: {type: 'jscin_im_v1, command: <command>, result: <result> }
  var kJscinType = 'jscin_im_v1';
  var kJscinKeystrokeCommand = "keystroke";

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

  function HandleNaclResponse(resp, remote_id) {
    if (resp.indexOf(kNaclDebugPrefix) == 0) {
      debug(resp.substr(kNaclDebugPrefix.length));
      return;
    }
    if (resp.indexOf(kNaclContextPrefix) == 0) {
      var ctx = JSON.parse(resp.substr(kNaclContextPrefix.length));
      debug("send Jscin IM response for", ctx);
      chrome.runtime.sendMessage(remote_id, CreateJscinKeystrokeResponse(ctx));
      return;
    }
    debug("unknown response from Nacl:", resp);
  }

  function IsJscinMessage(msg) {
    return (msg && msg.type == kJscinType && msg.command);
  }

  function CreateJscinKeystrokeResponse(data) {
    return { type: kJscinType, command: kJscinKeystrokeCommand, result: data };
  }

  function ProcessJscinMessage(msg) {
    if (!IsJscinMessage(msg)) {
      debug("Not JSCIN message", msg);
      return;
    }
    if (msg.command != kJscinKeystrokeCommand) {
      debug("Unsupported command", msg.command);
      return;
    }
    // keystrok: context, ev, k
    var k = msg.args[2];
    nacl.postMessage(PackNaclKeyCommand(k));
  }

  // TODO(hungte) We should also send id as part of the message.

  chrome.runtime.onMessageExternal.addListener(
      function (request, sender, sendResponse) {
        if (!IsJscinMessage(request))
          return;
        debug("registered to extension", sender.id);
        self.id = sender.id;
        ProcessJscinMessage(request);
      });

  nacl.addEventListener('message', function (ev) {
    if (!self.id) {
      debug("Nacl message while no registered extension...");
      return;
    }
    debug("Handle Nacl response...", ev.data);
    HandleNaclResponse(ev.data, self.id);
  }, false);
});
