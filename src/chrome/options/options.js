// Copyright 2011 Google Inc. All Rights Reserved.

/**
 * @fileoverview Options page for Chrome OS CIN.
 * @author zork@google.com (Zach Kuznia)
 */

import { $ } from "../jquery/jquery-ui.js";
import { Notify, NOTIFY_RELOAD_IM  } from "../notify.js";

// Here we must import the same set that the engine (e.g., croscin) is using,
// because that is the only way to get the list of registered modules.
import { jscin } from "../jscin/all.js";

import { parseGtab, IsGTabBlob } from "../jscin/gtab_parser.js";
import { parseCin } from "../jscin/cin_parser.js";
import { DetectInputMethodType } from "../jscin/quirks.js";
import { Config } from "../config.js";
import { ChromeStorage, LoadJSON, LoadArrayBuffer, LoadText } from "../jscin/storage.js";
import { _ } from "../i18n.js";

import { AddLogger } from "../jscin/logger.js";
const {debug, warn, error, assert, logger} = AddLogger("option");

const ClsExperimental = "experimental";
const ClsOptAdvanced = "optAdvanced";

// Use var for variables that we want to explore and change in the browser
// debugging tool.
let config = new Config();
let notify = new Notify();

// A list for managing loading messages in UI.
let table_loading = {};

let hasZH = false;
chrome.i18n.getAcceptLanguages((locales) => {
  for (const v of locales) {
    if (v.startsWith('zh')) {
      hasZH = true;
      break;
    }
  }
});
// ___: If accept_languages includes Chinese
function ___(ename, cname) {
  if (hasZH)
    return cname || ename;
  return ename || cname;
}

function encodeId(name) {
  const v = name.split("").map((v)=>v.charCodeAt().toString(16)).join('');
  return v;
}

function decodeId(id) {
  return id.match(/.{2}/g).map((v)=>String.fromCharCode(parseInt(v, 16))).join('');
}

async function reloadIM(name) {
  // See croscin
  notify.Send(NOTIFY_RELOAD_IM, name);
}

function HideByClass(cls, bg) {
  for (const n of document.getElementsByClassName(cls)) {
    if (!bg)
      n.style.display = 'none';
    else
      n.style.background = bg;
  }
}

function ShowByClass(cls) {
  for (const n of document.getElementsByClassName(cls)) {
    n.style.display = 'block';
  }
}

function ShowAlertRestartDialog(value) {
  debug('ShowAlertRestartDialog', value);
  const title = _("optionWarning");
  const text = _("optionOK");
  const modal = true;
  const click = function() {
    $(this).dialog("close");
  };
  const buttons = [{text, click}];
  $('#dialog_alert_restart').dialog({title, modal, buttons});
}

function initOpts() {
  // OpenVanilla only supports setting (in order):
  //  AUTO_FULLUP
  //  AUTO_RESET
  //  AUTO_COMPOSE
  //  SELKEY_SHIFT
  //  SPACE_AUTOUP
  //  (SPACE_RESET, AUTO_UPCHAR, and WILD_ENABLE are probably both implicit
  //  true)

  // MacOS behavior:
  //  Only allows setting AUTO_COMPOSE (+flag_disp_partial_match), with cursor
  //  set to the first candidate.  Press SPACE will commit the text under
  //  cursor.  Associate will keep appearing, but without cursor so you have
  //  to either select by 1~9 or arrow to get cursor first, not possible to
  //  keep committing by SPACE.

  // Generate the options list in the details window
  const opts_exp = [];
  const opts_advanced = [
    'SPACE_RESET', 'AUTO_UPCHAR', 'SPACE_AUTOUP',
    'WILD_ENABLE', 'END_KEY',
    'flag_unique_auto_send',
    'flag_disp_partial_match',
  ];
  let node = $('#divOpts');
  for (const o in jscin.OPTS) {
    const cls = `opt_${o}`;
    const div = $('<div/>').attr("id", `div_${cls}`).append(
      $('<input/>').attr("type", "checkbox").attr("id", cls)).
      append($('<label/>').attr("for", cls).attr("class", cls).
        text(_(cls)).attr('title', _(`title_${o}`)));
    if (opts_exp.includes(o))
      div.addClass(ClsExperimental);
    if (opts_advanced.includes(o))
      div.addClass(ClsOptAdvanced);
    node.append(div);
  }
  const id = '#optionOptShowAdvanced';
  let isBasic = true;
  $(id).button().on("click", function () {
    isBasic = !isBasic;
    if (isBasic)
      HideByClass(ClsOptAdvanced);
    else
      ShowByClass(ClsOptAdvanced);
    $(id).text(_(isBasic ? 'optionOptShowAdvanced' : 'optionOptShowBasic'));
  });

  function AssociateOpts(source, dest, reverse) {
    const src_id = `#opt_${source}`;
    const dest_id = `#opt_${dest}`;
    $(src_id).off("change").on("change", function() {
      let enabled = $(src_id).is(':checked');
      if (reverse)
        enabled = false;
      $(dest_id).prop("disabled", !enabled);
      const dest_label = $(`.opt_${dest}`);
      if (enabled)
        dest_label.removeClass('disabled');
      else
        dest_label.addClass('disabled');
    });
  }

  AssociateOpts('AUTO_UPCHAR', 'SPACE_AUTOUP');
  HideByClass(ClsOptAdvanced);
}

async function init() {
  await config.Load();
  if (config.Debug()) {
    logger.enableAllLoggers();
  }
  const debugFlag = config.Debug();

  // Localize all .option* elements.
  for (const v of $('*[class^="option"]')) {
    $(v).text(_(v.className));
  }

  initOpts();

  $('#available_im_list').sortable({
    revert: true,
    connectWith: ".sortable",
    helper: 'clone'
  }).disableSelection();

  $('#enabled_im_list').sortable({
    revert: true,
    connectWith: ".sortable",
    cancel: "li:only-child",
    helper: 'clone',
    update: function () {
      let new_list = [];
      // TODO(hungte) Replace each by something better.
      $('#enabled_im_list li').each(function() {
        new_list.push(decodeId($(this).attr('id').replace(/^ime_/, '')));
      });
      config.Set("InputMethods", new_list);
    }
  }).disableSelection();
  $("#accordion").accordion({heightStyle: "content"});

  loadTables();
  updateBytesInUse(); // no need to wait.

  $("#add_table_dialog").attr("title", _("optionAddTable")).dialog({
    autoOpen: false,
    width: 500,
    modal: true,
  });

  function selectAddDiv(target) {
    const targets = ['file', 'url', 'odlist'];
    for (const div of targets) {
      const selector = `#${div}_div`;
      if (div == target) {
        $(selector).show();
      } else {
        $(selector).hide();
      }
    }
    setAddTableStatus("");
  }

  $(".optionAddUrl").button().click(function() {
    selectAddDiv('url');
    $('#cin_table_url_input').addClass("ui-corner-all");

    $("#add_table_dialog").dialog('option', 'buttons', [
      {
        text: _("optionAddTable"),
        click: function() {
          const url = $("#cin_table_url_input").val();
          addTableFromUrl(url);
          $(this).dialog("close");
        }
      },
      {
        text: _("optionCancel"),
        click: function() {
          $(this).dialog("close");
        }
      }
    ]).dialog("open");
  });

  $(".optionAddFile").button().click(function() {
    selectAddDiv('file');
    $('#cin_table_file_input').button().addClass("ui-corner-all");

    $("#add_table_dialog").dialog('option', 'buttons', [
      {
        text: _("optionAddTable"),
        click: function() {
          const files = document.getElementById("cin_table_file_input").files;
          addTableFromFile(files);
          $(this).dialog("close");
        }
      },
      {
        text: _("optionCancel"),
        click: function() {
          $(this).dialog("close");
        }
      }
    ]).dialog("open");
  });

  $(".optionAddOpenDesktop").button().click(function () {
    selectAddDiv('odlist');
    let list = $("#odlist_select");
    list.change(() => {
      $('.btnAddTable').show();
    }).dblclick(() => {
      $('.btnAddTable').click();
    });

    function loadOD(reload) {
      list.empty();
      list.append('<option>Loading...</option>')
      $('.btnAddTable').hide();

      openDesktop.load(reload).then((data) => {
        list.empty();
        for (const v of data) {
          list.append($('<option></option>').val(v.cin).text(
            `${v.cname} (${v.ename}) - ${___(v.edesc, v.cdesc)}`));
        }
      });
    }
    loadOD();

    $("#add_table_dialog").dialog('option', 'buttons', [
      {
        text: _("optionAddTable"),
        class: 'btnAddTable',
        click: function() {
          const val = $('#odlist_select').val();
          $(this).dialog("close");
          addTableFromUrl(openDesktop.getURL(val));
        }
      },
      {
        text: _("optionCancel"),
        click: function() {
          $(this).dialog("close");
        }
      },
      {
        text: _('optionReload'),
        click: function() {
          if (confirm(_("optionAreYouSure"))) {
            loadOD(true);
          }
        }
      },
    ]).dialog("open");
    $('.btnAddTable').hide();
  });

  function SameWidth(...args) {
    const w = Math.max(...args.map((e)=>e.width()));
    args.forEach((e)=>e.width(w));
  }
  SameWidth($(".optionAddUrl"), $(".optionAddFile"));

  function BindCheck(name, callback, verbs) {
    if (!verbs)
      verbs = {'': (v)=>v};
    for (const [verb, mapper] of Object.entries(verbs)) {
      const val = mapper(config[name]());
      $(`#check${name}${verb}`).prop('checked',
        val).on('click', function () {
          const value = mapper($(this).prop('checked'));
          config.Set(name, value);
          if (callback)
            callback(value);
        });
    }
  }
  const verbRatioTrueFalse = {'True': (v)=>v, 'False': (v)=>!v};
  BindCheck('Debug');
  BindCheck('AddonPunctuations');
  BindCheck('AddonRelatedText');
  BindCheck('RawMode');
  BindCheck('ForceAltLocale');
  BindCheck('VerticalWindow', null, verbRatioTrueFalse);
  BindCheck('Emulation', ShowAlertRestartDialog);

  const im_modules = jscin.getModuleNames();
  let def_module = config.DefaultModule();
  if (!im_modules.includes(def_module))
    def_module = jscin.getModule()?.name;
  assert(def_module, "Cannot find the default module.");

  const selectMod = $('#formSelectModule');
  selectMod.empty();

  for (const name of im_modules.filter((v)=>v.startsWith("Gen"))) {
    const opt = $('<option></option>').val(name).text(name);
    if (name == def_module)
      opt.attr("selected", "selected");
    selectMod.append(opt);
  }
  selectMod.selectmenu({change: () => {
    config.Set("DefaultModule", selectMod.val());
    alert(_("optionReloadExtensionOrRestart"));
  }});
  $('#formSelectModule').controlgroup();
  $('#start_dumb_ime').button();
  $('#start_test_area').button();

  // Hide platform-specific options and experimental options.
  let divPlat = 'divOnCrOS';
  if (chrome?.input?.ime) {
    divPlat = 'divNonCrOS';
  }
  HideByClass(divPlat, debugFlag ? "yellow" : undefined);
  HideByClass(ClsExperimental, debugFlag ? "greenyellow" : undefined);
}

function removeFileExtension(filename) {
  return filename.split('.')[0];
}

function GuessNameFromURL(url) {
  const guess = removeFileExtension(url.split('\\').pop().split('/').pop().split('?')[0]);
  return guess || '<Unknown>';
}

async function addTableFromBlob(blob, source) {
  debug("addTableFromBlob", source, blob);

  if (source instanceof File) {
    source = source.name;
  }
  assert(typeof(source) === 'string', "Source must be either URL or File:", source);

  if (IsGTabBlob(blob)) {
    try {
      // No %ename from blob so let's "guess" from the URL name or the file
      // name.
      const ename = GuessNameFromURL(source);
      debug("Parsing GTAB into CIN:", source, ename);
      const cin = `%ename ${ename}\n` + parseGtab(blob);
      debug("Succesfully parsed a GTAB into CIN:", source, cin.substring(0,100).split('\n'));
      if (await addTable(cin, source)) {
        debug("addTableFromBlob: success.", source);
        return true;
      } else {
        debug("addTableFromBlob: Failed adding table:", source);
        return false;
      }
    } catch (err) {
      warn("Failed to parse as GTAB from:", source, err);
    }
  }

  let t;
  for (const locale of ['utf-8', 'big5', 'gbk', 'gb18030', 'utf-16le', 'utf-16be']) {
    try {
      t = new TextDecoder(locale, {fatal: true}).decode(blob);
      break;
    } catch (err) {
      debug("Failed to decode CIN table:", source, locale, err);
    }
  }
  if (!t) {
    setAddTableStatus(_("tableStatusFailedParsingMsg", `Unknown format: ${source}`), true);
    debug("Failed to decode the table:", source);
  } else if (await addTable(t, source)) {
    debug("Succesfully added a table:", source, t.substring(0,100).split('\n'));
    return;
  } else {
    // addTable should already gave the error message.
    debug("Failed to parse and add the table:", source);
  }
}

async function addTableFromUrl(url, progress=true) {
  const name = GuessNameFromURL(url);
  debug("addTableFromUrl:", name, url);
  try {
    if (url.replace(/^\s+|s+$/g, "") == "") {
      setAddTableStatus(_("tableStatusURLisEmpty"), true);
      return;
    }
    // Convert github blobs to raw format.
    url = url.replace(RegExp('^[^:]*://github.com/([^/]*)/([^/]*)/blob/'),
      'https://raw.github.com/$1/$2/');

    if (table_loading[url]) {
      setAddTableStatus(_("tableStatusStillDownloadingName", name), false);
      debug("Already loading:", url);
      return;
    }
    table_loading[url] = true;
    setAddTableStatus(_("tableStatusDownloadingName", name), false);

    let blob;
    if (progress) {
      let xhr = new XMLHttpRequest();
      xhr.addEventListener("progress", (e)=> {
        debug("progress", e);
        if (e.lengthComputable && e.total > 0) {
          const pct = Math.round(e.loaded / e.total * 100);
          setAddTableStatus(_("tableStatusDownloadingNamePct", [name, pct]), false);
        } else {
          setAddTableStatus(_("tableStatusDownloadingNameBytes", [name, e.loaded]), false);
        }
      }, false);
      xhr.addEventListener("load", (e)=> {
        setAddTableStatus(_("tableStatusDownloadedParseName", name), false);
        blob = e.currentTarget.response;
        addTableFromBlob(blob, url);
        delete table_loading[url];
      });
      xhr.onreadystatechange = () => {
        if (xhr.readyState != 4)
          return;
        if (xhr.status == 200) {
          // should be handled by the 'load' event.
        } else {
          debug(xhr);
          setAddTableStatus(_("tableStatusDownloadFailNameStatus", [name, xhr.statusText]), true);
          delete table_loading[url];
        }
      }
      xhr.open("GET", url, true);
      xhr.responseType = 'arraybuffer';
      xhr.send(null);
    } else {
      blob = await LoadArrayBuffer(url);
      setAddTableStatus(_("tableStatusDownloadedParseName", name), false);
      addTableFromBlob(blob, url);
      delete table_loading[url];
    }
  } catch (err) {
    delete table_loading[url];
    error("addTableFromUrl: error", url, err);
    setAddTableStatus(_("tableStatusDownloadFailNameStatus", [name, err]), true);
    return;
  }
}

async function addTableFromFile(files) {
  for (const f of files) {
    debug("addTableFromFile", f);
    let fr = new FileReader();
    fr.addEventListener("load", () => {
      addTableFromBlob(fr.result, f);
    });
    fr.addEventListener("error", () => {
      error("Failed loading file:", f);
    });

    // Trigger the read event.
    fr.readAsArrayBuffer(f);
  }
}

async function addTable(content, url) {

  // TODO(hungte) Parse using jscin.createTable
  // so we can better figure out the right name.
  // Parse the content
  const [success, cin, msg] = parseCin(content);

  if (!success) {
    // result is now the error message.
    setAddTableStatus(_("tableStatusFailedParsingMsg", msg), true);
    return false;
  }

  const name = jscin.getTableSaveName(cin, url);
  debug("addTable - test overwrite - ", name);
  const info = jscin.getTableInfo(name);
  if (info) {
    if (!confirm(_("optionOverwriteTable", [info.cname, info.ename]))) {
      setAddTableStatus(_("tableStatusNotAdded"), true);
      return false;
    } else {
      $(`#ime_${encodeId(name)}`).remove();
    }
  }

  const real_type = DetectInputMethodType(cin);
  debug("addTable: table type:", real_type);

  // Update the UI
  const new_name = await jscin.saveTable(name, cin, url);
  if (!new_name) {
    setAddTableStatus(_("tableStatusFailedParsingMsg", "Cannot save"), true);
    return false;
  }

  addTableToList(new_name, '#enabled_im_list', true);
  setAddTableStatus(_("tableStatusAddedName", new_name), false);
  config.InsertInputMethod(new_name);
  updateBytesInUse(); // no need to wait.
  return true;
}

async function updateBytesInUse(storage=jscin.storage) {
  const bytes_in_use = await storage.getBytesInUse();
  $('#optionBytesInUse').text(_("optionBytesInUse", `${bytes_in_use}`));
}

function setAddTableStatus(status, err) {
  const status_field = document.getElementById("add_table_status");
  status_field.innerText = status;
  status_field.className = err ? "status_error" : "status_ok";
}

function addTableToList(name, list_id, do_insert) {
  const info = jscin.getTableInfo(name);
  const ename = info.ename;
  const cname = info.cname;
  const url = info.url || '';

  const ext_url = chrome.runtime.getURL("");
  const builtin = url.startsWith(ext_url) && (name in BuiltinIMs);
  // id must be safe for jQuery expressions.
  const id = `ime_${encodeId(name)}`;
  const icon= '<span class="ui-icon ui-icon-arrowthick-2-n-s">';

  const display_name = `${cname} (${ename})`;
  const builtin_desc = builtin ? `[${_("optionBuiltin")}]` : "";

  const name_label = `${display_name} ${builtin_desc}`;
  const item = $('<li class="ui-state-default"></li>').
    attr('id', id).text(name_label);
  if (do_insert)
    $(list_id).prepend(item);
  else
    $(list_id).append(item);

  $(`#${id}`).prepend(icon).click(async function() {
    const table = await jscin.loadTable(name, url);
    const opts = (await jscin.loadOpts(name)) || {};
    const im_type = DetectInputMethodType(table.cin);

    $('#optionTableDetailName').text(name_label);
    $('#optionTableDetailSource').val(url);
    $('#query_keystrokes').prop('checked', config.AddonCrossQuery() == name);
    if (im_type) {
      $('.optionResetOpts').text(_('optionResetOptsAs', _(`im_${im_type}`)));
    } else {
      $('.optionResetOpts').text(_('optionResetOpts'));
    }

    function SetOpts(opts) {
      for (const o in jscin.OPTS) {
        const idsel = `#opt_${o}`;
        $(idsel).prop('checked', opts[o]).trigger('change');
      }
    }
    SetOpts(opts);
    let default_opts = undefined;

    $('.optionResetOpts').button().off("click").click(function () {
      if (!default_opts)
        default_opts = jscin.getTableDefaultOpts(table.cin)
      SetOpts(default_opts);
    });

    let buttons = [{
      text: _("optionOK"),
      click: async function () {
        // Save CrossQuery
        const checked = $('#query_keystrokes').is(':checked');
        const current = config.AddonCrossQuery();
        let update = false;
        let reload_im = false;

        if (checked)
          update = (current != name);
        else
          update = (current == name);

        reload_im ||= update;
        if (update)
          config.Set("AddonCrossQuery", checked ? name : '');

        // Save Opts
        update = false;
        let new_opts = {};
        for (const o in jscin.OPTS) {
          const id = `opt_${o}`;
          new_opts[o] = $(`#${id}`).is(':checked');
          if (new_opts[o] != opts[o])
            update = true;
        }
        reload_im ||= update;
        if (update) {
          debug("Save new opts:", new_opts);
          jscin.saveOpts(name, new_opts);
        }

        if (reload_im)
          reloadIM(name);

        $(this).dialog("close");
      } }];

    const ims = config.InputMethods();
    const keep = builtin || (ims.length == 1 && ims[0] == name);

    /* Currently we expect at least one table is enabled. */
    if (!keep) {
      buttons.push( { text: _('optionRemove'),
        click: function () {
          if (confirm(_("optionAreYouSure"))) {
            removeTable(name);
            $(`#${id}`).remove();
          }
          $(this).dialog("close");

        } });
    }

    if (url && url.includes('://') && !builtin) {
      buttons.push({
        text: _('optionReload'),
        click: function() {
          debug("optionReload:", url);
          addTableFromUrl(url);  // Confirmation in addTable.
          $(this).dialog("close");
        }});
    }
    buttons.push(
    {
      text: _("optionCancel"),
      click: function() {
        $(this).dialog("close");
      }
    });

    $('#table_detail_dialog').dialog({
      title: _("optionTableDetail"),
      minWidth: 575,
      buttons: buttons,
      modal: true
    });
  });
}

function loadTables() {
  const available = jscin.getTableNames();
  const enabled = config.InputMethods();

  // First make sure we've visited all in the 'enabled', so we have more chance
  // to see the available input methods even if table info list is out of sync.
  for (const name of enabled.filter((n) => available.includes(n))) {
    addTableToList(name, '#enabled_im_list');
  }
  // Next add anything available but not in the enabled.
  for (const name of available.filter((n) => !enabled.includes(n))) {
    addTableToList(name, '#available_im_list');
  }
}

function removeTable(name) {
  debug('removeTable:', name);
  if (config.AddonCrossQuery() == name)
    config.Set("AddonCrossQuery", "");
  if (config.InputMethods().includes(name))
    config.RemoveInputMethod(name);
  jscin.removeTable(name);
  updateBytesInUse(); // no need to wait.
}

class ChineseOpenDesktop {
  constructor() {
    this.OD_URL = 'https://github.com/chinese-opendesktop/cin-tables/raw/refs/heads/master/';
    this.KEY_STORAGE = 'chinese-opendesktop/cin-tables';
    this.storage = new ChromeStorage();
    this.cache = null;
  }
  getURL(file) {
    return `${this.OD_URL}${file}`;
  }
  parseIndex(text) {
    let result = [];
    if (!text)
      return result;
    for (const line of text.split('\n')) {
      const regex = /^ *(?<cin>[^.]*\.cin),"(?<ename>[^(]*)\((?<cname>[^)]*)\)","(?<cdesc>[^;]*);?(?<edesc>.*)?"/;
      const v = line.match(regex)?.groups;
      if (!v)
        continue;
      result.push(v);
    }
    debug("parseInt: result", result);
    return result;
  }
  async load(force) {
    if (this.cache && !force)
      return this.cache;
    if (!force) {
      this.cache = await this.storage.get(this.KEY_STORAGE);
    }
    if (!this.cache || force) {
      debug("OD: Need to reload the README from remote.");
      this.cache = this.parseIndex(await LoadText(this.getURL("README"))) || [];
      this.storage.set(this.KEY_STORAGE, this.cache);
      updateBytesInUse(); // no need to wait.
    }
    return this.cache;
  }
  get() {
    return this.result;
  }
}

/* Global variables. */
const openDesktop = new ChineseOpenDesktop();
const BuiltinIMs = await LoadJSON("tables/builtin.json");

/* Export name for debugging. */
globalThis.jscin = jscin;
globalThis.options = {
  BuiltinIMs,
  openDesktop,
  jscin,
  config,
  logger,
  table_loading,
}

console.log("Welcome to croscin options!\n\n",
            "To debug, type and explore these name spaces:\n",
            "- options [.config]\n",
            "- jscin\n",
            "To reset all the configs, do:\n",
            "- chrome.storage.local.clear(); chrome.runtime.reload();\n");
$(init);
