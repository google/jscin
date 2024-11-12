// Copyright 2011 Google Inc. All Rights Reserved.

/**
 * @fileoverview ChromeOS Chinese Input Method in JavaScript Extension
 * @author hungte@google.com (Hung-Te Lin)
 */

import { Config  } from "./config.js";
import { jscin } from "./jscin/all.js";
import { LoadJSON, LoadText } from "./jscin/storage.js";
import { Migration } from "./jscin/migration.js";
import { ChromeInputIme } from "./ime_api/chrome_input_ime.js";

export { jscin };

import { AddLogger } from "./jscin/logger.js";
const {log, debug, info, warn, error, assert, trace, logger} = AddLogger("croscin");

class Heartbeat {
  constructor() {
    this.interval = null;
    this.storage = chrome.storage.session;
  }
  async start() {
    // This is only required by extension Manifest V3.
    if (!this.storage)
      return;
    // Today only the CrOS implementation will put croscin instance in the
    // background service worker (that will need heartbeat). The webpage
    // implementation or iframe based implementations do not need it.
    if (!chrome?.input?.ime)
      return;
    if (this.interval) {
      assert(false, "Heartbeat.start: should not run again without stop().");
      return;
    }
    debug("Heartbeat.start");
    this.run();
    this.interval = setInterval(this.run.bind(this), 20 * 1000);
  }
  async run() {
    const heartbeat = new Date().getTime();
    debug("Heartbeat.run", heartbeat);
    await this.storage.set({heartbeat});
  }
  async stop() {
    debug("Heartbeat.stop");
    clearInterval(this.interval);
    this.interval = null;
  }
}

/* The main class for an Input Method Environment. */
export class CrOS_CIN {

  constructor(ime_api) {
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

    this.ime_api = ime_api || globalThis.chrome?.input?.ime || new ChromeInputIme();
    debug("ime_api set to:", this.ime_api);

    this.heartbeat = new Heartbeat();
    this.config = new Config();

    this.jscin = jscin;
    this.logger = logger;

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
    // UI initialization is done. See Initialize.
  }

  async Initialize() {
    debug("Initialize: start.");

    // Simulate pageAction in Manifest V2.
    if(chrome.action)
      chrome.action.disable();

    chrome.runtime.onMessage.addListener((ev) => {
    });
    await this.config.Load();

    let version = chrome.runtime.getManifest().version;
    let reload = (version !== this.config.Version());

    if (reload && jscin.MIGRATION) {
      warn("Start migration from version", this.config.Version(), "to", version);
      let migration = new Migration(jscin);
      await migration.migrateAll();
      // Reload the config in case it was changed in migration and the
      // onChanged events couldn't happen before loading built-in tables.
      await this.config.Load();
    } else {
      debug("No migration:", version, this.config.Version());
    }

    await this.LoadBuiltinTables(reload);
    if (reload) {
      this.config.Set("Version", version);
    }
    this.registerEventHandlers();

    await this.LoadPreferences();

    this.config.Bind("InputMethods", (value) => {
      if (!this.im)
        return;
      debug("Changed InputMethods(), activate the new default IM.");
      this.ActivateInputMethod(this.config.DefaultInputMethod());
    });
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
      debug("Commit: WARNING: input text was not a simple string (pick only [0]):", text);
      text = text[0];
    }

    if (!text) {
      debug("Commit: warning: called with empty string.", text);
      return false;
    }

    let arg = this.GetContextArg();
    arg.text = text;
    this.ime_api.commitText(arg);
    debug("Commit: value:", text);
    return true;
  }

  ProcessKeyEvent(keyData) {
    debug("ProcessKeyEvent:", keyData.key, keyData);

    // Currently all of the modules uses key down.
    if (keyData.type != 'keydown') {
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
    debug("ProcessKeyEvent: Unknown return value:", ret);
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

  SetCandidateWindowProperties(properties) {
    let arg = this.GetEngineArg();
    debug("SetCandidateWindowProperties: ", properties);
    arg.properties = properties;
    this.ime_api.setCandidateWindowProperties(arg);
  }

  InitializeUI() {
    // Vertical candidates window looks better on ChromeOS.
    // CIN tables don't expect cursor in candidates window.
    this.SetCandidateWindowProperties({
      vertical: true,
      cursorVisible: false,
      visible: false,
      auxiliaryText: this.im_label,
      auxiliaryTextVisible: true});

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
    debug("UpdateComposition:", all_text);
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
    const candidates = candidate_list.map((c, i) => ({
      candidate: c,
      id: i,
      label: labels.charAt(i)})
    );
    debug("UpdateCandidates: candidate_list:", candidate_list,
          "labels:", labels, 'candidates:', candidates);

    // UpdateComposition will only update the candidate list if it's not empty.
    // The caller must be responsible for calling setCandidateWindowProperties.

    const len = candidates.length;
    if (!len)
      return len;

    let arg = this.GetContextArg();
    arg.candidates = candidates;
    this.ime_api.setCandidates(arg);
    return len;
  }

  UpdateUI(keystroke, mcch, selkey, lcch, cursor) {
    if (arguments.length == 0) {
      keystroke = this.imctx.keystroke;
      selkey = this.imctx.selkey;
      mcch = this.imctx.mcch;
      lcch = this.imctx.lcch;
      cursor = this.imctx.edit_pos;
    }

    // process:
    //  - keystroke
    const has_composition = this.UpdateComposition(keystroke, lcch, cursor);
    //  - selkey, mcch
    let num_candidates = this.UpdateCandidates(mcch, selkey);
    // show_keystroke(cch_publish) can be displayed in auxiliary text.

    let visible = num_candidates > 0;
    let props = { visible };

    if (num_candidates)
      props.pageSize = num_candidates;

    // The IM, or the addon, wants to say something
    let aux = this.imctx.override_aux || this.im_label;
    if (aux != this.imctx.last_aux) {
      this.imctx.last_aux = aux;
      props.auxiliaryText = aux;
    }

    this.SetCandidateWindowProperties(props);
  }

  async ActivateInputMethod(name) {
    if (name === undefined) {
      if (this.config.InputMethods().includes(this.im_name))
        name = this.im_name;
      else
        name = this.config.DefaultInputMethod();
    }
    if (name && name == this.im_name) {
      debug("ActivateInputMethod: already activated:", name);
      // This may happen when the user has pressed Ctrl-space (Activate,
      // Deactivate) multiple times. We can either always reset the context and
      // remove the IM, or keep the IM and only re-initialize UI.
      this.InitializeUI();
      return;
    }

    let info = jscin.getTableInfo(name);
    debug("ActivateInputMethod:", name, info);
    if (info && info.url && info.url.startsWith(chrome.runtime.getURL(""))) {
      // Preload the builtin table.
      debug("Preload:", name, info.url);
      await jscin.loadTable(name, info.url);
    }

    let imctx = {};
    let im = await jscin.activateInputMethod(
      name, imctx, null, this.config.DefaultModule());

    if (!im) {
      debug("ActivateInputMethod: Cannot start Input Method:", name);
      return;
    }

    this.imctx = imctx;
    this.im = im;
    this.im_name = name;
    this.im_label = jscin.getLabel(name);

    // Apply Addon configuration.
    this.config.forEach((key, value) => {
      if (!key.startsWith('Addon'))
        return;
      this.imctx[key] = value;
    });

    this.InitializeUI();
    debug("ActivateInputMethod: Started:", name, this.im);
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
    debug("UpdateMenu:", menu_items);
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
      debug("LoadBuiltinTables: No built-in tables.");
      return;
    }
    let available = jscin.getTableNames();
    const saveBuiltin = false;

    for (let name in list) {
      if (available.includes(name) && !reload) {
        debug("LoadBuiltinTables: skip loaded table:", name);
        continue;
      }

      // Clear any existing records - both the table contents and info.
      await jscin.removeTable(name);

      let url = chrome.runtime.getURL(`tables/${list[name]}`);
      let content = await LoadText(url);
      assert(content, "Can't load built-in table:", url);
      // Built-in tables may have a special name so they won't overwrite user
      // installed tables and we should use the name from `builtin.son`.
      await jscin.saveTable(name, content, url, {}, saveBuiltin);
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
    debug("LoadPreferences: config:", this.config.config);
  }

  openOptionsPage() {
    if (chrome.runtime?.openOptionsPage) {
      debug("openOptionsPage: using chrome.runtime.openOptionsPage()");
      return chrome.runtime.openOptionsPage();
    }

    // If croscin runs inside the content script (e.g., emulation mode), then
    // we don't have the permission to call chrome.tabs nor chrome.runtime. The
    // ime_api must provide a special event `OpenOptionsPage` for that.
    debug("openOptionsPage: No chrome.runtime.openOptionsPage; broadcast for help.");
    if (this.ime_api.onOpenOptionsPage)
      this.ime_api.onOpenOptionsPage.dispatch();
    else
      error("Sorry, no way to open the options page.");
  }

  // Registers event handlers to the browser.
  registerEventHandlers() {
    let ime_api = this.ime_api;

    ime_api.onActivate.addListener((engineID) => {
      debug('onActivate: croscin started.', engineID);
      this.engineID = engineID;
      this.heartbeat.start()
      this.ActivateInputMethod();
    });

    ime_api.onDeactivated.addListener((engineID) => {
      debug('onDeactivated: croscin stopped.');
      this.heartbeat.stop()
      this.context = null;
    });

    ime_api.onFocus.addListener((context) => {
      this.context = context;
      // Calling updateUI here to forward unfinished composition (preedit) into
      // the new input element.
      this.UpdateUI();
    });

    ime_api.onBlur.addListener((contextID) => {
      if (!this.context) {
        debug("onBlur: WARNING: no existing context.");
        return;
      }
      debug("onBlur", contextID);
      if (this.context.contextID != contextID) {
        debug("onBlur: WARNING: incompatible context.",
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
      debug("onKeyEvent", engine, keyData);
      return this.ProcessKeyEvent(keyData);
    });

    ime_api.onReset.addListener((engineID) => {
      debug("onReset", engineID);
      if (this.im) {
        this.im.reset(this.imctx);
        this.UpdateUI();
      }
    });

    ime_api.onInputContextUpdate.addListener((context) => {
      debug("onInputContextUpdate", context);
    });

    ime_api.onCandidateClicked.addListener(
        (engineID, candidateID, button) => {
          debug("onCandidateClicked", candidateID,  button);
          if (button == "left") {
            this.SimulateKeyDown(this.imctx.selkey.charAt(candidateID));
          }
    });

    ime_api.onMenuItemActivated.addListener((engineID, name) =>{
      debug("onMenuItemActivated: name=", name);
      const imePrefix = 'ime:'

      if (name == this.kMenuOptions) {
        this.openOptionsPage();
      } else if (name.startsWith(imePrefix)) {
        this.ActivateInputMethod(name.substring(imePrefix.length));
      } else {
        assert(false, "Invalid menu item", name);
      }
    });

    // Non-standard APIs
    if (ime_api.onMenuPopup) {
      ime_api.onMenuPopup.addListener(() => {
        debug("onMenuPopup");
        this.UpdateMenu();
      });
    }
  }
}
