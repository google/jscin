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

  self.kOptionsPage = "options";

  self.imctx = {};
  self.im = null;
  self.im_name = '';

  self.engineID = null;
  self.context = null;

  // TODO(hungte) remove this workaround: "onActivate is not called if user is
  // already using extension and then reload..
  self.engineID = jscin.ENGINE_ID;

  // Standard utilities
  self.GetContextArg = function() {
    return {'contextID': this.context.contextID};
  }

  self.GetEngineArg = function() {
    return {'engineID': jscin.ENGINE_ID};
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
      var arg = self.GetContextArg();
      arg.text = text;
      self.ime_api.commitText(arg);
      self.log("croscin.Commit: value: " + text);
    } else {
      self.log("croscin.Commmit: warning: called with empty string.");
    }
  }

  self.ProcessKeyEvent = function(keyData) {
    self.log("ProcessKeyEvent: " + keyData.key);

    // Currently all of the modules uses key down.
    if (keyData.type != 'keydown') {
      return false;
    }

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
    self.log("croscin.ProcessKeyEvent: Unknown return value: " + ret);
    return false;
  }

  self.SimulateKeyDown = function(key) {
    var keyEvent = {
      'type': 'keydown',
      'key': key,
      'altKey': false,
      'ctrlKey': false,
      'shiftKey': false,
    };
    return self.ProcessKeyEvent(keyEvent);
  }

  self.SetCanditesWindowProperty = function(name, value) {
    self.log("croscin.SetCanditesWindowProperty: set " + name + ": " + value);
    var prop = {};
    var arg = self.GetEngineArg();
    arg['properties'] = prop;
    prop[name] = value;
    self.ime_api.setCandidateWindowProperties(arg);
  }

  self.InitializeUI = function() {
    // Vertical candidates window looks better on ChromeOS.
    self.SetCanditesWindowProperty('vertical', true);
    // CIN tables don't expect cursor in candidates window.
    self.SetCanditesWindowProperty('cursorVisible', false);
    self.SetCanditesWindowProperty('visible', false);

    // Setup menu
    self.InitializeMenu();
  }

  self.UpdateComposition = function(text) {
    var arg = self.GetContextArg();
    self.log("croscin.UpdateComposition: " + text);
    if (text) {
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

  self.UpdateCandidates = function(candidate_list, labels) {
    self.log("croscin.UpdateCandidates: elements = " + candidate_list.length +
             ", labels = " + labels);
    // TODO(hungte) set more properties:
    //  auxiliaryText, auxiliaryTextVisible.
    if (candidate_list.length > 0) {
      var arg = self.GetContextArg();
      var candidates = [];
      for (var i = 0; i < candidate_list.length; i++) {
        // TODO(hungte) fix label, annotation
        candidates.push({
          'candidate': candidate_list[i],
          'id': i,
          'label': labels.charAt(i),
        });
      }
      self.log('candidates:');
      self.log(candidates);
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

  self.ActivateInputMethod = function(name) {
    // kDefaultCinTableKey should match options/options.js
    var kDefaultCinTableKey = "default_cin_table";

    if (!name) {
      name = jscin.readLocalStorage(
          kDefaultCinTableKey, jscin.default_input_method);
    }

    if (name in jscin.input_methods) {
      self.log("croscin.ActivateInputMethod: Started: " + name);
      // TODO(hungte) Create new instance only if required.
      self.imctx = {};
      self.im = jscin.create_input_method(name, self.imctx);
      self.im_name = name;
      self.InitializeUI();
      jscin.writeLocalStorage(kDefaultCinTableKey, name);
      jscin.default_input_method = name;
    } else {
      self.log("croscin.ActivateInputMethod: Invalid item: " + name);
    }
  }

  self.UpdateMenu = function() {
    var menu_items = [];
    for (var i in jscin.input_methods) {
      menu_items.push({
        "id": "ime:" + i,
        "checked": i == self.im_name
      });
    }
    var arg = self.GetEngineArg();
    arg['items'] = menu_items;
    self.ime_api.updateMenuItems(arg);
  }

  self.InitializeMenu = function() {
    var menu_items = [];

    for (var i in jscin.input_methods) {
      var label = jscin.input_methods[i]["label"];
      if (!label)
        label = i;
      menu_items.push({
        "id": "ime:" + i,
        "label": label,
        "style": "radio"
      });
    }
    self.log("croscin.InitializeMenu: " + menu_items.length + " items.");

    // Add a separator and options  (Separator does not work yet).
    menu_items.push({"id": "",
                     "style": "separator"});
    menu_items.push({"id": self.kOptionsPage,
                     "label": "Options"});
    var arg = self.GetEngineArg();
    arg['items'] = menu_items;
    self.ime_api.setMenuItems(arg);

    self.UpdateMenu();
  }

  self.registerEventHandlers();
  // Start the default input method.
  self.ActivateInputMethod(null);
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

    // Calling updateUI here is to carry unfinished composition (preedit) into
    // the new input element.
    self.UpdateUI();
  });

  ime_api.onBlur.addListener(function(contextID) {
    if (!self.context) {
      self.log("croscin.onBlur: WARNING: no existing context.");
      return;
    }
    if (self.context.contextID != contextID) {
      self.log("croscin.onBlur: WARNING: incompatible context.");
      return;
    }
    // TODO(hungte) Uncomment this if we don't want context to be carried when
    // input focus changes.
    // self.SimulateKeyDown('Esc');
    self.context = null;
  });

  ime_api.onKeyEvent.addListener(function(engine, keyData) {
    return self.ProcessKeyEvent(keyData);
  });

  ime_api.onInputContextUpdate.addListener(function(context) {
  });

  ime_api.onCandidateClicked.addListener(
      function(engineID, candidateID, button) {
        self.log("onCandidateClicked: " + candidateID + ", " + button);
        if (button == "left") {
          self.SimulateKeyDown(self.imctx.selkey.charAt(candidateID));
        }
  });

  ime_api.onMenuItemActivated.addListener(function(engineID, name) {
    self.log("croscin.onMenuItemActivated: name=" + name);

    if (name == self.kOptionsPage) {
      var options_url = chrome.extension.getURL("options/options.html");
      chrome.tabs.create({"url": options_url});
    } else if (name.match(/^ime:/)) {
      self.ActivateInputMethod(name.replace(/^ime:/, ''));
    }
  });

  window.on_config_changed = function() {
    // Some configuration is changed - we need to validate and refresh all.
    self.log("croscin.on_config_changed: notified.");
    self.InitializeUI();
  }
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
