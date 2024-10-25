// Copyright 2011 Google Inc. All Rights Reserved.

/**
 * @fileoverview ChromeOS Chinese Input Method in JavaScript Extension
 * @author hungte@google.com (Hung-Te Lin)
 */

import { Config  } from "./config.js";
import { jscin } from "./jscin/all.js";
import { getKeyDescription } from "./jscin/key_event.js";
import { LoadJSON, LoadText } from "./jscin/storage.js";
import { Migration } from "./jscin/migration.js";

import { ChromeInputIME } from "./emulation/chrome_input_ime.js";
import { BackgroundIPCHost } from "./emulation/ipc_background.js";

import { AddLogger } from "./jscin/logger.js";
const {log, debug, info, warn, error, assert, trace, logger} = AddLogger("croscin");

export { jscin };

/* The main class for an Input Method Environment. */
export class IME {

  constructor() {
    // The engine ID must match input_components.id in manifest file.
    this.kEngineId = 'cros_cin';

    this.kMenuOptions = "options";
    this.kMenuOptionsLabel = chrome.i18n.getMessage("menuOptions");

    this.engineID = this.kEngineId;
    this.context = null;

    this.imctx = {};
    this.im = null;
    this.im_name = '';
    this.im_label = '';

    this.ime_api = null
    this.ime_api_type = 'Not available';

    this.cross_query = {};
    this.config = new Config();

    this.config.Bind("Debug", (value)=> {
      logger.enableAllLoggers(value);
    }).Bind("Emulation", (value)=> {
      debug("Emulation", value);
      // Can't restart extension here - should
      // be handled in the options confirm dialog.
    });
    this.config.forEach((key, value) => {
      if (!key.startsWith('Addon'))
        return;
      this.config.Bind(key, (v) => {
        debug("Config: set:", key, "=>", v);
        this.imctx[key] = v;
      });
    });

    // UI related changes (InputMethod)
    // must be bound only after first time
    // UI initialization is done.

    this.config.Load().then(() => {
      this.Initialize();
    });
  }

  async Initialize() {
    debug("Start to Initialize");
    let version = chrome.runtime.getManifest().version;
    let reload = (version !== this.config.Version());

    if (jscin.MIGRATION) {
      let migration = new Migration(jscin);
      await migration.migrateAll();
    }

    await this.LoadBuiltinTables(reload);
    if (reload) {
      this.config.Set("Version", version);
    }
    jscin.reload_configuration();
    this.detect_ime_api();
    this.registerEventHandlers();

    this.LoadPreferences();
    this.ActivateInputMethod();

    this.config.Bind("InputMethods", (value)=> {
      debug("Changed InputMethods(), need to reload UI.");
      jscin.reload_configuration();
      this.InitializeUI();
      this.ActivateInputMethod();
    });

    if (this.ime_api.isEmulation) {
      new BackgroundIPCHost(this.ime_api);
    }
  }

  // Standard utilities

  GetContextArg() {
    return {'contextID': this.context.contextID};
  }

  GetEngineArg() {
    return {'engineID': this.kEngineId};
  }

  // Core functions
  Commit(text) {
    // TODO(hungte) fixme when gen_inp has fixed this.
    if (text && typeof(text) != typeof('')) {
      text = text[0];
      debug("croscin.Commit: WARNING: input text is not a simple string.");
    }

    if (!text) {
      debug("croscin.Commit: warning: called with empty string.");
      return false;
    }

    let arg = this.GetContextArg();
    arg.text = text;
    this.ime_api.commitText(arg);
    debug("croscin.Commit: value:", text);
    return true;
  }

  ProcessKeyEvent(keyData) {
    debug("ProcessKeyEvent:", keyData.key, keyData);

    // Currently all of the modules uses key down.
    if (keyData.type != 'keydown') {
      return false;
    }

    /* Currently no one sets the imctx.check_accepted_keys
     * so this is only for debugging (for local to test
     * IPC behavior).
     */
    if (this.imctx.check_accepted_keys &&
        !this.ime_api.onImplAcceptedKeys &&
        !this.im.get_accepted_keys(this.imctx).includes(
          getKeyDescription(keyData))) {
      debug("Key not accepted", keyData);
      return false;
    }

    let ret = this.im.keystroke(this.imctx, keyData);

    switch (ret) {
      case jscin.IMKEY_COMMIT:
        debug("im.keystroke: return IMKEY_COMMIT");
        this.UpdateUI();
        this.Commit(this.imctx.cch);
        this.imctx.cch_publish = this.imctx.cch;
        this.imctx.cch = '';
        return true;

      case jscin.IMKEY_ABSORB:
        debug("im.keystroke: return IMKEY_ABSORB");
        this.UpdateUI();
        return true;

      case jscin.IMKEY_IGNORE:
        debug("im.keystroke: return IMKEY_IGNORE");
        this.UpdateUI();
        return false;

      case jscin.IMKEY_DELAY:
        // UI will be updated later, see im.set_notifier.
        return true;
    }

    // default: Unknown return value.
    debug("croscin.ProcessKeyEvent: Unknown return value:", ret);
    return false;
  }

  SimulateKeyDown(key) {
    let keyEvent = {
      type: 'keydown',
      key: key,
      ctrlKey: false,
      shiftKey: false,
      altKey: false,
      metaKey: false,
    };
    return this.ProcessKeyEvent(keyEvent);
  }

  SetCandidatesWindowProperty(properties) {
    // debug("SetCandidatesWindowProperty: ", properties);
    let arg = this.GetEngineArg();
    if (arguments.length == 2) {
      // Legacy support.
      let name = arguments[0], value = arguments[1];
      properties = {};
      properties[name] = value;
      debug('SetCandidatesWindowProperty:', name, '=', value);
    }
    arg.properties = properties;
    this.ime_api.setCandidateWindowProperties(arg);
  }

  InitializeUI() {
    // Vertical candidates window looks better on ChromeOS.
    // CIN tables don't expect cursor in candidates window.
    this.SetCandidatesWindowProperty({
      vertical: true,
      cursorVisible: false,
      visible: false,
      auxiliaryText: this.im_label,
      auxiliaryTextVisible: false});

    // Setup menu
    this.UpdateMenu();
  }

  UpdateComposition(keystroke, buffer, cursor) {
    let arg = this.GetContextArg();
    // Format: buffer...|cursor-keystroke...buffer
    keystroke = keystroke || '';
    buffer = buffer || [];
    let buffer_text = buffer.join('');
    let all_text = buffer_text + keystroke;
    debug("croscin.UpdateComposition:", all_text);
    if (typeof cursor === 'undefined'){
      cursor = all_text.length;
    }
    if (all_text) {
      arg.cursor = cursor;
      // Selection to show where keystrokes are.
      arg.selectionStart = cursor;
      arg.selectionEnd = cursor + keystroke.length;
      arg.text = (buffer_text.substring(0, cursor) + keystroke +
                  buffer_text.substring(cursor));
      if (buffer_text) {
        arg.segments = [];
        for (let i = 0, len = buffer.length, total = 0; i < len; i++) {
          if (cursor >= total && cursor < total + buffer[i].length) {
            let next = total + keystroke.length + buffer[i].length;
            // cursor will split segment: [total, cursor); [cursor, next).
            if (cursor > total) {
              arg.segments.push({
                start: total, end: cursor, style: "underline"});
            }
            if (next > cursor) {
              arg.segments.push({
                start: cursor + keystroke.length, end: next, style: "underline"});
            }
            total = next;
          } else {
            arg.segments.push({
              start: total, end: total + buffer[i].length, style: "underline"});
            total += buffer[i].length;
          }
        }
      }
      this.ime_api.setComposition(arg);
    } else {
      this.ime_api.clearComposition(arg);
    }
    return all_text;
  }

  UpdateCandidates(candidate_list, labels) {
    if (candidate_list === undefined) {
      assert("candidate_list (mcch) is undefined");
      return;
    }
    if (typeof(candidate_list) == typeof('')) {
      assert('candidate_list (mcch) should be an array!', candidate_list);
      candidate_list = candidate_list.split('');
    }
    debug("croscin.UpdateCandidates: candidate_list:", candidate_list,
          "labels:", labels);
    let candidates = candidate_list.map((c, i) => ({
      candidate: c,
      id: i,
      label: labels.charAt(i)})
    );
    let len = candidates.length;
    debug('candidates:', candidates);

    if (len) {
      let arg = this.GetContextArg();
      arg.candidates = candidates;
      this.ime_api.setCandidates(arg);
      this.SetCandidatesWindowProperty({
        pageSize: len, visible: true});
    } else {
      this.SetCandidatesWindowProperty({visible: false});
    }
    return len > 0;
  }

  UpdateUI(keystroke, mcch, selkey, lcch, cursor) {
    if (arguments.length == 0) {
      keystroke = this.imctx.keystroke;
      selkey = this.imctx.selkey;
      mcch = this.imctx.mcch;
      lcch = this.imctx.lcch;
      cursor = this.imctx.edit_pos;
    }

    let has_composition, has_candidates;
    // process:
    //  - keystroke
    has_composition = this.UpdateComposition(keystroke, lcch, cursor);
    //  - selkey, mcch
    has_candidates = this.UpdateCandidates(mcch, selkey);
    // show_keystroke(cch_publish) can be displayed in auxiliary text.

    // The IM, or the addon, wants to say something
    let aux_text = this.imctx.override_aux;
    let aux_show = (aux_text || has_composition || has_candidates) ? true : false

    this.SetCandidatesWindowProperty({
      auxiliaryText: aux_text || this.im_label,
      auxiliaryTextVisible: aux_show});

    // Hint for IME to get key expections.
    // TODO(hungte) Change this from function to context.
    if (this.ime_api.onImplAcceptedKeys) {
      debug("update accepted keys");
      this.ime_api.dispatchEvent("ImplAcceptedKeys",
          this.im.get_accepted_keys(this.imctx));
    }
  }

  ActivateInputMethod(name) {
    if (name === undefined)
      name = this.config.DefaultInputMethod();
    if (name && name == this.im_name) {
      debug("ActivateInputMethod: already activated:", name);
      this.UpdateMenu();
      return;
    }

    if (!(name in jscin.input_methods)) {
      debug("ActivateInputMethod: ERROR: Invalid name:", name);
      return;
    }

    this.imctx = {};
    this.im = jscin.activateInputMethod(name, this.imctx);
    // For delayed response (ex, external IM modules, see IMKEY_DELAY).
    this.im.set_notifier(() => {
      if (!this.context) {
        debug("IM notified after context destroyed.");
        return;
      }
      this.UpdateUI();
      if (this.imctx.cch) {
        this.Commit(this.imctx.cch);
        this.imctx.cch_publish = this.imctx.cch;
        this.imctx.cch = '';
      }
    });
    // TODO(hungte) Remove this dirty workaround when we can do cmmit-on-blur.
    if (!this.ime_api.isEmulation) {
      this.imctx.commit_on_blur = true;
    }
    this.im_name = name;
    this.im_label = jscin.getLabel(name);

    // Apply Addon configuration.
    this.config.forEach((key, value) => {
      if (!key.startsWith('Addon'))
        return;
      this.imctx[key] = value;
    });

    this.InitializeUI();
    debug("activateInputMethod: Started:", name, this.im);
  }

  UpdateMenu() {
    let menu_items = [];

    for (let name of this.config.InputMethods()) {
      let label = jscin.getLabel(name) || name;
      menu_items.push({
        "id": `ime:${name}`,
        "label": label,
        "style": "radio",
        "checked": name == this.im_name,
      });
    }
    debug("croscin.UpdateMenu:", menu_items);
    // Separator is broken on R28, and may not appear after R29.
    // It depends on ChromeOS UI design so let's not use it.
    // menu_items.push({"id": "", "style": "separator"});
    menu_items.push({"id": this.kMenuOptions, "label": this.kMenuOptionsLabel});

    let arg = this.GetEngineArg();
    arg['items'] = menu_items;
    this.ime_api.setMenuItems(arg);
  }

  async LoadBuiltinTables(reload) {
    let list = await LoadJSON("tables/builtin.json");
    if (!list) {
      debug("croscin.LoadBuiltinTables: No built-in tables.");
      return;
    }
    let available = jscin.getTableNames();
    for (let table_name in list) {
      if (available.includes(table_name) && !reload) {
        debug("croscin.LoadBuiltinTables: skip loaded table:", table_name);
        continue;
      }
      let url = chrome.runtime.getURL(`tables/${list[table_name]}`);
      let content = await LoadText(url);
      if (!content) {
        debug("croscin.LoadBuiltinTables: Failed to load:", url);
        continue;
      }
      jscin.saveTable(null, content, {builtin: true, url: url});
    }

  }

  LoadPreferences() {

    // Normalize preferences.
    let available = jscin.getTableNames();
    let k = null;
    let enabled = this.config.InputMethods().filter(
      (v) => available.includes(v) );

    // If the enabled list is broken, let's enable all.
    if (enabled.length < 1) {
      enabled = available;
    }

    // To compare arrays, hack with string compare.
    if (this.config.InputMethods().toString() != enabled.toString()) {
      warn("LoadPreferences: need to update config.InputMethods:",
        this.config.InputMethods(), enabled);
      this.config.Set("InputMethods", enabled);
    }
    debug("croscin.config", this.config.config);
  }

  getDefaultModule() {
    return jscin.getDefaultModuleName();
  }

  setDefaultModule(new_value) {
    return jscin.setDefaultModuleName(new_value);
  }

  getAvailableModules() {
    return jscin.getModuleNames();
  }

  // IME API Handler

  set_ime_api(ime_api, name) {
    this.ime_api = ime_api;
    this.ime_api_type = name;
    debug("IME API set to:", name);
  }

  detect_ime_api() {
    /* find out proper ime_api: chrome.input.ime or chrome.experimental.input */
    try {
      /**
       * Modern Chrome supports partial IME API so we need to check some CrOS
       * specific method.
       */
      if (chrome.input.ime.onMenuItemActivated) {
        this.set_ime_api(chrome.input.ime, "chromeos");
      }
    } catch (err) {
      // Binding failure can't really be caught - it'll simply escape current
      // syntax scope.
    }

    if (!this.ime_api) {
      // provided by emulation/chrome_input_ime.js
      if (ChromeInputIME) {
        debug("Switched to Javascript Emulation IME API...");
        this.set_ime_api(new ChromeInputIME, "emulation");
        if (chrome.input) {
          chrome.input.ime = this.ime_api;
        } else {
          chrome.input = { ime: this.ime_api };
        }
      } else {
        debug("Switched to dummy IME API...");
        this.set_ime_api(this.create_dummy_ime_api(), "dummy");
      }
    }
  }

  create_dummy_ime_api() {
    let dummy_function = () => {};
    let dummy_listener = { addListener: () => {} };
    return {
      clearComposition: dummy_function,
      commitText: dummy_function,
      setCandidates: dummy_function,
      setCandidateWindowProperties: dummy_function,
      setComposition: dummy_function,
      setMenuItems: dummy_function,
      onActivate: dummy_listener,
      onDeactivated: dummy_listener,
      onFocus: dummy_listener,
      onBlur: dummy_listener,
      onKeyEvent: dummy_listener,
      onInputContextUpdate: dummy_listener,
      onCandidateClicked: dummy_listener,
      onMenuItemActivated: dummy_listener,
    };
  }

  // Registers event handlers to the browser.
  registerEventHandlers() {
    let ime_api = this.ime_api;

    ime_api.onActivate.addListener((engineID) => {
      debug('onActivate: croscin started.', engineID);
      this.engineID = engineID;
      this.InitializeUI();
      // We should activate IME here, but in order to speed up we did
      // ActivateInputMethod in Initialize, and use hard-coded engine ID before it
      // is assigned.
    });

    ime_api.onDeactivated.addListener((engineID) => {
      debug('onDeactivated: croscin stopped.');
      this.context = null;
    });

    ime_api.onFocus.addListener((context) => {
      this.context = context;
      // Calling updateUI here to forward unfinished composition (preedit) into
      // the new input element.
      this.UpdateUI();
    });

    ime_api.onBlur.addListener((contextID) => {
      debug("croscin: onBlur", contextID);
      if (!this.context) {
        debug("croscin.onBlur: WARNING: no existing context.");
        return;
      }
      if (this.context.contextID != contextID) {
        debug("croscin.onBlur: WARNING: incompatible context.",
                 this.context.contextID, contextID);
        return;
      }

      // Note anything left in composition will be automatically commited by
      // chrome.input.ime. We tried to prevent this in onReset but in vain.
      // To synchronize behavior on ChromeOS / Chrome, the best solution is to
      // let emulated chrome.input.ime do commit from composition.
      this.context = null;
    });

    ime_api.onKeyEvent.addListener((engine, keyData) => {
      debug("croscin.onKeyEvent", engine, keyData);
      return this.ProcessKeyEvent(keyData);
    });

    ime_api.onReset.addListener((engineID) => {
      debug("croscin.onReset", engineID);
      if (this.im) {
        this.im.reset(this.imctx);
        this.UpdateUI();
      }
    });

    ime_api.onInputContextUpdate.addListener((context) => {
      debug("croscin.onInputContextUpdate", context);
    });

    ime_api.onCandidateClicked.addListener(
        (engineID, candidateID, button) => {
          debug("onCandidateClicked", candidateID,  button);
          if (button == "left") {
            this.SimulateKeyDown(this.imctx.selkey.charAt(candidateID));
          }
    });

    ime_api.onMenuItemActivated.addListener((engineID, name) =>{
      debug("croscin.onMenuItemActivated: name=", name);

      if (name == this.kMenuOptions) {
        let options_url = chrome.runtime.getURL("options/options.html");
        // Tabs are better, but if there are no active windows (which is common in
        // ChromeOS if you put everything behind and activate by menu) then
        // chrome.window.create must be used.
        chrome.tabs.getSelected(null, (tab) => {
          if (tab) {
            chrome.tabs.create({"url": options_url});
          } else {
            chrome.windows.create({
              url: options_url,
              type: "popup",
              width: screen.width * 0.8,
              height: screen.height * 0.8,
              focused: true
            });
          }
        });
      } else if (name.match(/^ime:/)) {
        this.ActivateInputMethod(name.replace(/^ime:/, ''));
      }
    });

    // Implementation events (by emulation).
    if (ime_api.onImplUpdateUI) {
      ime_api.onImplUpdateUI.addListener((...args) => { this.UpdateUI(args); });
    }
    if (ime_api.onImplCommit) {
      ime_api.onImplCommit.addListener((...args)   => { this.Commit(args); });
    }
    /* Export again. */
    window.jscin = jscin;
  }
}

export var croscin = {IME: IME, logger: logger};
console.log("ChromeOS Extension for JavaScript Chinese Input Method.\n\n",
            "To turn on/off debug messages of each component,",
            "change the `verbose` property from command:\n\n",
            "  croscin.logger.getAllLoggers() \n\n",
            "To turn on all components, do:\n\n",
            "  croscin.logger.enableAllLoggers() \n\n");
