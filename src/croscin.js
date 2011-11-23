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
  self.imctx = {};
  self.im = jscin.create_input_method(jscin.default_im, self.imctx);

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
    if (text) {
      var arg = self.GetBaseArg();
      arg.text = text;
      self.ime_api.commitText(arg);
      self.log("croscin.Commit: value: " + text);
    } else {
      self.log("croscin.Commmit: warning: called with empty string.");
    }
  }

  self.SetCanditesWindowProperty = function(name, value) {
    self.log("croscin.SetCanditesWindowProperty: set " + name + ": " + value);
    var prop = {};
    var arg = { engineID: self.context.engineID,
                properties: prop };
    prop[name] = value;
    self.ime_api.setCandidateWindowProperties(arg);
  }

  self.InitalizeUI = function() {
    // Vertical candidates window looks better on ChromeOS.
    self.SetCanditesWindowProperty('vertical', true);
    self.SetCanditesWindowProperty('cursorVisible', true);
  }

  self.UpdateComposition = function(text) {
    var arg = self.GetBaseArg();
    self.log("croscin.UpdateComposition: " + text);
    if (text.length > 0) {
      arg.text = text;
      // Select everything in composition.
      arg.selectionStart = 0;
      arg.selectionEnd = text.length;
      arg.cursor = text.length;
      self.ime_api.setComposition(arg);
    } else {
      self.ime_api.clearComposition(arg);
    }
  }

  self.UpdateCandidates = function(candidate_list) {
    self.log("croscin.UpdateComposition: elements = " + candidate_list.length);
    // TODO(hungte) set more properties:
    //  auxiliaryText, auxiliaryTextVisible.
    if (candidate_list.length > 0) {
      var arg = self.GetBaseArg();
      var candidates = Array(candidate_list.length);
      for (var i = 0; i < candidates.length; i++) {
        // TODO(hungte) fix label, annotation
        candidates[i] = {
          'candidate': candidate_list[i];
          'id': i,
        }
      }
      arg.candidates = candidates;
      self.ime_api.setCandidates(arg);
      self.SetCanditesWindowProperty('pageSize', candidate_list.length);
      self.SetCanditesWindowProperty('visible', true);
    } else {
      self.SetCanditesWindowProperty('visible', false);
    }
  }

  self.UpdateUI = function() {
    var info = self.inpinfo;
    // process:
    //  - keystroke
    //  - suggest_skeystroke
    self.UpdateComposition(info.suggest_skeystroke);
    //  - selkey
    //  - mcch
    self.UpdateCandidates(mcch);
    //  - lcch
    //  - cch_publish
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
    self.UpdateUI();
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
        self.Commit(inpinfo.cch);
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
