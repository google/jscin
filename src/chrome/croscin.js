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

  // TODO(hungte) load default debug flag from options
  self.debug = true;

  self.kMenuOptions = "options";
  self.kMenuOptionsLabel = chrome.i18n.getMessage("menuOptions");

  self.imctx = {};
  self.im = null;
  self.im_name = '';
  self.im_label = '';

  self.engineID = null;
  self.context = null;

  // Standard utilities
  self.GetContextArg = function() {
    return {'contextID': this.context.contextID};
  }

  self.GetEngineArg = function() {
    return {'engineID': jscin.ENGINE_ID};
  }

  self.log = function(s) {
    if (self.debug)
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

  self.SetCandidatesWindowProperty = function(name, value) {
    self.log("croscin.SetCandidatesWindowProperty: set " + name + ": " + value);
    var prop = {};
    var arg = self.GetEngineArg();
    arg['properties'] = prop;
    prop[name] = value;
    self.ime_api.setCandidateWindowProperties(arg);
  }

  self.InitializeUI = function() {
    // Vertical candidates window looks better on ChromeOS.
    self.SetCandidatesWindowProperty('vertical', true);
    // CIN tables don't expect cursor in candidates window.
    self.SetCandidatesWindowProperty('cursorVisible', false);
    self.SetCandidatesWindowProperty('visible', false);

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
      self.SetCandidatesWindowProperty('pageSize', candidate_list.length);
      self.SetCandidatesWindowProperty('auxiliaryTextVisible', true);
      self.SetCandidatesWindowProperty('visible', true);
    } else {
      self.SetCandidatesWindowProperty('auxiliaryTextVisible', false);
      self.SetCandidatesWindowProperty('visible', false);
    }
  }

  self.UpdateUI = function() {
    var imctx = self.imctx;
    // process:
    //  - keystroke
    self.UpdateComposition(imctx.keystroke);
    //  - selkey, mcch
    self.UpdateCandidates(imctx.mcch, imctx.selkey);
    //  - (TODO) lcch, cch_publish
  }

  self.ActivateInputMethod = function(name) {

    if (name && name == self.im_name) {
      self.log("croscin.ActivateInputMethod: already activated: " + name);
      return;
    }
    if (!name) {
      name = jscin.readLocalStorage(
          jscin.kDefaultCinTableKey, jscin.default_input_method);
    }

    if (name in jscin.input_methods) {
      self.log("croscin.ActivateInputMethod: Started: " + name);
      self.imctx = {};
      self.im = jscin.create_input_method(name, self.imctx);
      self.im_name = name;
      self.im_label = jscin.get_input_method_label(name);
      self.InitializeUI();
      jscin.writeLocalStorage(jscin.kDefaultCinTableKey, name);
      jscin.default_input_method = name;
      self.SetCandidatesWindowProperty('auxiliaryText', self.im_label);
    } else {
      self.log("croscin.ActivateInputMethod: Invalid item: " + name);
    }
  }

  self.InitializeMenu = function() {
    var menu_items = [];

    for (var i in jscin.input_methods) {
      var label = jscin.get_input_method_label(i);
      if (label)
        label = label + " (" + i + ")";
      else
        label = i;
      menu_items.push({
        "id": "ime:" + i,
        "label": label,
        "style": "radio",
        "checked": i == self.im_name,
      });
    }
    self.log("croscin.InitializeMenu: " + menu_items.length + " items.");
    // Separator is broken on R28, and may not appear after R29.
    // It depends on ChromeOS UI design so let's not use it.
    // menu_items.push({"id": "", "style": "separator"});
    menu_items.push({"id": self.kMenuOptions, "label": self.kMenuOptionsLabel});

    var arg = self.GetEngineArg();
    arg['items'] = menu_items;
    self.ime_api.setMenuItems(arg);

    // TODO(hungte) ime_api.updateMenuItems is broken so we can't really
    // "update" it - just always do setMenuItems.
    // self.UpdateMenu();
  }

  self.LoadExtensionResource = function(url) {
    var rsrc = chrome.extension.getURL(url);
    var xhr = new XMLHttpRequest();
    self.log("croscin.LoadExtensionResource: " + url);
    xhr.open("GET", rsrc, false);
    xhr.send();
    if (xhr.readyState != 4 || xhr.status != 200) {
      self.log("croscin.LoadExtensionResource: failed to fetch: " + url);
      return null;
    }
    return xhr.responseText;
  }

  self.LoadBuiltinTables = function(reload) {
    var list = self.LoadExtensionResource("tables/builtin.json");
    if (!list) {
      self.log("croscin.LoadBuiltinTables: No built-in tables.");
      return;
    }
    var table_metadata = jscin.getTableMetadatas();
    list = JSON.parse(list);
    for (var table_name in list) {
      if (table_name in table_metadata && !reload) {
        self.log("croscin.LoadBuiltinTables: skip loaded table: " + table_name);
        continue;
      }
      var content = self.LoadExtensionResource("tables/" + list[table_name]);
      if (!content) {
        self.log("croscin.LoadBuiltinTables: Failed to load: " + table_name);
        continue;
      }
      var results = parseCin(content);
      if (!results[0]) {
        self.log("croscin.LoadBuiltinTables: Incorrect table: " + table_name);
        continue;
      }
      var table_content = results[1].data;
      var metadata = results[1].metadata;
      self.log("croscin.LoadBuiltinTables: Load table: " + table_name);
      var ename = metadata['ename'];
      metadata['builtin'] = true;
      jscin.addTable(ename, metadata, table_content);
    }
  }

  var version = chrome.runtime.getManifest().version;
  var reload = (version !== jscin.readLocalStorage(jscin.kVersionKey, 0));
  self.LoadBuiltinTables(reload);
  if (reload) {
    jscin.reloadNonBuiltinTables();
    jscin.writeLocalStorage(jscin.kVersionKey, version);
  }
  jscin.reload_configuration();
  self.resolve_ime_api();
  if (navigator.appVersion.match(/Mac OS/)) {
    self.hook_dumb_ime();
    jscin.ime_api = self.ime_api;  // FIXME(kcwu): dirty hack
  }
  self.registerEventHandlers();
  // Start the default input method.
  self.ActivateInputMethod(null);
};

croscin.IME.prototype.resolve_ime_api = function() {
  /* find out proper ime_api: chrome.input.ime or chrome.experimental.input */
  var ime_api = null;
  if ("input" in chrome && "ime" in chrome.input)
    ime_api = chrome.input.ime;
  else
    ime_api = chrome.experimental.input;
  if ("ime" in ime_api)
    ime_api = ime_api.ime;

  this.ime_api = ime_api;
}

croscin.IME.prototype.hook_dumb_ime = function() {
  var self = this;
  var hook_listener = [
      'onActivate', 'onDeactivated', 'onFocus', 'onBlur', 'onKeyEvent',
      'onInputContextUpdate', 'onCandidateClicked', 'onMenuItemActivated',
      ];
  jscin.dumb_ime = { 'listener': {} };
  ime_api = self.ime_api;

  for (var i in hook_listener) {
    var name = hook_listener[i];
    jscin.dumb_ime.listener[name] = [];
    ime_api[name].addListener = (function (name) {
      return function (arg) {
        jscin.dumb_ime.listener[name].push(arg);
      };
    })(name);
  }
}

/**
 * Registers event handlers to the browser.
 */
croscin.IME.prototype.registerEventHandlers = function() {
  var self = this;
  ime_api = self.ime_api;

  ime_api.onActivate.addListener(function(engineID) {
    self.engineID = engineID;
    self.InitializeUI();
  });

  ime_api.onDeactivated.addListener(function(engineID) {
    self.context = null;
  });

  ime_api.onFocus.addListener(function(context) {
    self.context = context;
    // Calling updateUI here to forward unfinished composition (preedit) into
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

    if (name == self.kMenuOptions) {
      var options_url = chrome.extension.getURL("options/options.html");
      // Tabs are better, but if there are no active windows (which is common in
      // ChromeOS if you put everything behind) then chrome.tabs.create would
      // fail.
      chrome.windows.create({"url": options_url, type:"popup"});
    } else if (name.match(/^ime:/)) {
      self.ActivateInputMethod(name.replace(/^ime:/, ''));
    }
  });

  window.on_debug_mode_change = function(debug) {
    self.debug = debug;
  }

  window.on_config_changed = function() {
    // Some configuration is changed - we need to validate and refresh all.
    self.log("croscin.on_config_changed: notified.");
    jscin.reload_configuration();
    self.InitializeUI();
  }

  window.jscin = jscin;
};

// Browser loader entry
document.addEventListener(
    'readystatechange',
    function() {
      if (document.readyState === 'complete') {
        foobar = new croscin.IME;
      }
    }
)
