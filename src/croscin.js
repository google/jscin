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

  self.engineID = null;
  self.context = null;

  // TODO(hungte) remove this workaround: "onActivate is not called if user is
  // already using extension and then reload..
  self.engineID = jscin.ENGINE_ID;

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
    // TODO(hungte) fixme when gen_inp has fixed this.
    if (typeof(text) != typeof('')) {
      text = text[0];
      self.log("croscin.Commit: WARNING: input text is not a simple string.");
    }
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
    var arg = { engineID: self.engineID,
                properties: prop };
    prop[name] = value;
    self.ime_api.setCandidateWindowProperties(arg);
  }

  self.InitializeUI = function() {
    // Vertical candidates window looks better on ChromeOS.
    self.SetCanditesWindowProperty('vertical', true);
    self.SetCanditesWindowProperty('cursorVisible', true);
  }

  self.UpdateComposition = function(text) {
    var arg = self.GetBaseArg();
    self.log("croscin.UpdateComposition: " + text);
    if (text) {
      arg.text = text;
      // Select everything in composition.
      arg.selectionStart = 0;
      arg.selectionEnd = text.length;
      // TODO(hungte) enable this once it's supported
      // arg.cursor = text.length;
      self.ime_api.setComposition(arg);
    } else {
      self.ime_api.clearComposition(arg);
    }
  }

  self.UpdateCandidates = function(candidate_list, labels) {
    self.log("croscin.UpdateCandidates: elements = " + candidate_list.length +
             ", labels = " + labels);
    // TODO(hungte) set more properties:
    //  auxiliaryText, auxiliaryTextVisible.
    if (candidate_list.length > 0) {
      var arg = self.GetBaseArg();
      var candidates = Array(candidate_list.length);
      for (var i = 0; i < candidates.length; i++) {
        // TODO(hungte) fix label, annotation
        candidates[i] = {
          'candidate': candidate_list[i],
          'id': i,
          'label': labels.charAt(i),
        }
        self.log(candidates[i]);
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
    var imctx = self.imctx;
    // process:
    //  - keystroke
    //  - suggest_skeystroke
    self.UpdateComposition(imctx.keystroke);
    //  - selkey
    //  - mcch
    self.UpdateCandidates(imctx.mcch, imctx.selkey);
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
  );

  ime_api.onActivate.addListener(function(engineID) {
    self.engineID = engineID;
    self.InitializeUI();
  });

  ime_api.onDeactivated.addListener(function(engineID) {
    self.context = null;
  });

  ime_api.onFocus.addListener(function(context) {
    self.context = context;
    // TODO(hungte) remove this workaround: "onActivate is not called if user
    // reloads extension.
    self.InitializeUI();
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

    var ret = self.im.onKeystroke(self.imctx, keyData);
    self.log(dump_inpinfo(self.imctx));

    switch (ret) {
      case jscin.IMKEY_COMMIT:
        self.log("im.onKeystroke: return IMKEY_COMMIT");
        self.Commit(self.imctx.cch);
        self.UpdateUI();
        return true;

      case jscin.IMKEY_ABSORB:
        self.log("im.onKeystroke: return IMKEY_ABSORB");
        self.UpdateUI();
        return true;

      case jscin.IMKEY_IGNORE:
        self.log("im.onKeystroke: return IMKEY_IGNORE");
        self.UpdateUI();
        return false;
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
    }
  });
};

// Browser loader entry
document.addEventListener(
    'readystatechange',
    function() {
      if (document.readyState === 'complete') {
        new croscin.IME;
      }
    }
)
