// Copyright 2011 Google Inc. All Rights Reserved.

/**
 * @fileoverview ChromeOS Chinese Input Method in JavaScript Extension
 * @author hungte@google.com (Hung-Te Lin)
 */

/**
 * The root namespace.
 */

var croscin = {};

/**
 * Chinese IME class.
 * @constructor
 */
croscin.IME = function() {
  var self = this;

  // TODO(hungte) support multiple im's
  self.inp_info = {}
  self.im = jscin.create_input_method(jscin.default_im, self.inp_info);

  self.context = null;
  self.registerEventHandlers();

  // Standard utilities
  self.GetBaseArg = function() {
    var arg = {};
    arg.contextID = this.context.contextID;
    return arg;
  }

  self.log = function(s) {
    jscin.log(s);
  }

  // Core functions
  self.Commit = function(text) {
    var arg = self.GetBaseArg();
    arg.text = text;
    self.ime_api.commitText(arg);
  }

  self.UpdateComposition = function(text) {
  }

  self.UpdateCandidates = function(text) {
  }

  self.InitalizeUI = function() {
  }

};

/**
 * Registers event handlers to the browser.
 */
croscin.IME.prototype.registerEventHandlers = function() {
  /* find out proper ime_api: chrome.input.ime or chrome.experimental.input */
  var ime_api = null;
  if ("input" in chrome && "ime" in chrome.input)
    ime_api = chrome.input.ime;
  else
    ime_api = chrome.experimental.input;
  if ("ime" in ime_api)
    ime_api = ime_api.ime;

  var self = this;
  self.ime_api = ime_api;

  // Setup menu
  var kOptionsPage = "options";
  var kMenuItems = [{
    "id": kOptionsPage,
    "label": "Options"
  }];

  ime_api.setMenuItems({
    "engineID": jscin.ENGINE_ID,
    "items": kMenuItems}
  )

  ime_api.onActivate.addListener(function(engineID) {
    self.engineID = engineID;
  });

  ime_api.onDeactivated.addListener(function(engineID) {
    self.context = null;
  });

  ime_api.onFocus.addListener(function(context) {
    self.context = context;
  });

  ime_api.onBlur.addListener(function(contextID) {
    if (!self.context) {
      return;
    }
    if (self.context.contextID != contextID) {
      return;
    }
    self.context = null;
  });

  ime_api.onKeyEvent.addListener(function(engine, keyData) {
    console.log('croscin.js: onKeyEvent: ', keyData);

    // Currently all of the modules uses key down.
    if (keyData.type != 'keydown') {
      return false;
    }

    // TODO re-map key events here.... or not.

    var ret = self.im.onKeystroke(self.inpinfo, keyData);
    switch (ret) {
      case constant.IMKEY_COMMIT:
        self.Commit();
        self.UpdateUI();
        return true;

      case constant.IMKEY_ABSORB:
      case constant.IMKEY_IGNORE:
        self.UpdateUI();
        break true;
    }

    // default: Unknown return value.
    self.log("Unknown return value: " + ret);
    return false;
  });

  ime_api.onInputContextUpdate.addListener(function(context) {
  });

  ime_api.onCandidateClicked.addListener(
      function(engineID, candidateID, button) {
      });

  ime_api.onMenuItemActivated.addListener(function(engineID, name) {
    if (name == kOptionsPage) {
      var options_url = chrome.extension.getURL("options.html");
      chrome.tabs.create({"url": options_url});
    });
};

document.addEventListener(
    'readystatechange',
    function() {
      if (document.readyState === 'complete') {
        new croscin.IME;
      }
    }
)
