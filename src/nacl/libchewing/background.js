// Copyright 2013 Google Inc. All Rights Reserved.

/**
 * @fileoverview JSCIN external extension Nacl module background script.
 * @author hungte@google.com (Hung-Te Lin)
 */

// Keys to communicate with Nacl (nacl.cc)
var kNaclKeyPrefix = "key:";
var kNaclDebugPrefix = "debug:";
var kNaclContextPrefix = "context:";

// Jscin IM protocol v1: (jscin/crext_inip.js)
//  jscin->im: {type: 'jscin_im_v1', key: <key>}
//  im->jscin: {type: 'jscin_im_v1, im: <context> }
var kJscinType = 'jscin_im_v1';
var kJscinKeyName = 'key';
var kJscinImName = 'im';

var debug = true;

document.addEventListener( 'readystatechange', function() {
  if (document.readyState !== 'complete')
    return;

  function PackNaclKeyCommand(key) {
    return kNaclKeyPrefix + key;
  }

  function HandleNaclResponse(resp, remote_id) {
    if (resp.indexOf(kNaclDebugPrefix) == 0) {
      if (debug)
        console.log(resp.substr(kNaclDebugPrefix.length));
      return;
    }
    if (resp.indexOf(kNaclContextPrefix) == 0) {
      var ctx = JSON.parse(resp.substr(kNaclContextPrefix.length));
      if (debug)
        console.log("send Jscin IM response for", ctx);
      chrome.runtime.sendMessage(remote_id, CreateJscinImResponse(ctx));
      return;
    }
    if (debug)
      console.log("unknown response from Nacl:", resp);
  }

  function IsJscinMessage(msg) {
    return (msg && msg.type == kJscinType);
  }

  function CreateJscinImResponse(data) {
    return { type: kJscinType, im: data };
  }

  function GetJscinKeyMessage(msg) {
    return msg[kJscinKeyName];
  }

  var nacl = document.getElementById('nacl');
  var self = {};

  // TODO(hungte) We should also send id as part of the message.

  chrome.runtime.onMessageExternal.addListener(
      function (request, sender, sendResponse) {
        if (!IsJscinMessage(request))
          return;
        if (debug)
          console.log("registered to extension", sender.id);
        self.id = sender.id;
        nacl.postMessage(PackNaclKeyCommand(GetJscinKeyMessage(request)));
      });

  nacl.addEventListener('message', function (ev) {
    if (!self.id) {
      if (debug)
        console.log("Nacl message while no registered extension...");
      return;
    }
    if (debug)
      console.log("Handle Nacl response...", ev.data);
    HandleNaclResponse(ev.data, self.id);
  }, false);
});
