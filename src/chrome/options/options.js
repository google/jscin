// Copyright 2011 Google Inc. All Rights Reserved.

/**
 * @fileoverview Options page for Chrome OS CIN.
 * @author zork@google.com (Zach Kuznia)
 */

import { $, jQuery } from "../jquery/jquery-ui.js";

// Here we must import the same set that the engine (e.g., croscin) is using,
// because that is the only way to get the list of registered modules.
import { jscin } from "../jscin/all.js";

import { parseGtab, IsGTabBlob } from "../jscin/gtab_parser.js";
import { parseCin } from "../jscin/cin_parser.js";
import { Config } from "../config.js";
import { ChromeStorage, LoadJSON, LoadArrayBuffer, LoadText } from "../jscin/storage.js";

import { AddLogger } from "../jscin/logger.js";
const {log, debug, info, warn, error, assert, trace, logger} = AddLogger("option");

// Use var for variables that we want to explore and change in the browser
// debugging tool.
let config = new Config();

// A list for managing loading messages in UI.
let table_loading = {};

// _: Let Chrome decide (_locales)
let _ = chrome.i18n.getMessage;

// __: Follow UI Language
function __(ename, cname) {
  if (chrome.i18n.getUILanguage().startsWith('zh'))
    return cname;
  return ename;
}

let hasZH = false;
chrome.i18n.getAcceptLanguages((locales) => {
  for (let v of locales) {
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

function SetElementsText(...args) {
  for (let name of args) {
    $(`.${name}`).text(_(name));
  }
}

function encodeId(name) {
  let v = name.split("").map((v)=>v.charCodeAt().toString(16)).join('');
  return v;
}

function decodeId(id) {
  return id.match(/.{2}/g).map((v)=>String.fromCharCode(parseInt(v, 16))).join('');
}

function getSelectedTypeFromUI() {
  return KnownTypes[$('#add_table_setting').prop('selectedIndex')];
}

async function init() {
  await config.Load();
  if (config.Debug()) {
    logger.enableAllLoggers();
  }

  SetElementsText("optionCaption", "optionInputMethodTables",
      "optionHowToEnableTables", "optionEnabledTables", "optionAvailableTables",
      "optionAddTables", "optionAddUrl", "optionAddFile", "optionAddOpenDesktop",
      "optionTableDetailNameHeader", "optionTableDetailSourceHeader",
      "optionTableDetailTypeHeader", "optionQueryKeystrokes",
      "optionSettingChoices",
      "optionGeneral", "optionSupportNonChromeOS",
      "optionAlertChangeSupportNonChromeOS",
      "optionRawMode", "optionRelatedText", "optionPunctuations",
      "optionSelectDefaultInputModule", "optionSandbox",
      "optionDebug", "optionDebugMessage");

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
    update: function (event, ui) {
      let new_list = [];
      $('#enabled_im_list li').each(function(index) {
        new_list.push(decodeId($(this).attr('id').replace(/^ime_/, '')));
      });
      config.Set("InputMethods", new_list);
    }
  }).disableSelection();
  $("#accordion").accordion({heightStyle: "content"});

  await loadTables();
  updateBytesInUse(); // no need to wait.

  // TODO(hungte) we should autodetect again after source is specified.
  let select = $("#add_table_setting");
  select.empty();

  KnownTypes.forEach((entry, i) => {
    let option = $("<option>", {id: `option${i}`});
    option.text(`${entry.ename} ${entry.cname}`);
    if (entry.default)
      option.attr("selected", "selected");
    select.append(option);
  });

  $("#add_table_dialog").attr("title", _("optionAddTable"));

  $("#add_table_dialog").dialog({
    autoOpen: false,
    width: 500,
    modal: true,
  });

  $(".optionAddUrl").button().click(function(event) {
    setAddTableStatus("");
    $("#file_div").hide();
    $("#url_div").show();
    $("#doc_div").hide();
    $("#odlist_div").hide();
    $('#cin_table_url_input').addClass("ui-corner-all");

    $("#add_table_dialog").dialog('option', 'buttons', [
      {
        text: _("optionAddTable"),
        click: function() {
          let url = $("#cin_table_url_input").val();
          addTableFromUrl(url, getSelectedTypeFromUI());
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
    select.selectmenu();
  });

  $(".optionAddFile").button().click(function(event) {
    setAddTableStatus("");
    $("#file_div").show();
    $("#url_div").hide();
    $("#doc_div").hide();
    $("#odlist_div").hide();
    $('#cin_table_file_input').button().addClass("ui-corner-all");

    $("#add_table_dialog").dialog('option', 'buttons', [
      {
        text: _("optionAddTable"),
        click: function() {
          let files = document.getElementById("cin_table_file_input").files;
          addTableFromFile(files, getSelectedTypeFromUI());
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
    select.selectmenu();
  });

  $(".optionAddOpenDesktop").button().click(function (event) {
    $("#file_div").hide();
    $("#url_div").hide();
    $("#doc_div").hide();
    $("#odlist_div").show();
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
        for (let v of data) {
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
          let val = $('#odlist_select').val();
          $(this).dialog("close");
          addTableFromUrl(openDesktop.getURL(val), getSelectedTypeFromUI());
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
    select.selectmenu();
  });

  function SameWidth(...args) {
    const w = Math.max(...args.map((e)=>e.width()));
    args.forEach((e)=>e.width(w));
  }
  SameWidth($(".optionAddUrl"), $(".optionAddFile"));

  if (chrome?.input?.ime)
    $('#divSupportNonCrOS').display = 'none';

  $('#checkSupportNonChromeOS').prop("checked",
    config.Emulation()).click(function ()
  {
    config.Set("Emulation", $(this).prop("checked"));
    let buttons = {};
    buttons[_("optionOK")] = function () {
      $(this).dialog("close");
    };
    $('#dialog_alert_change_support_non_chromeos').dialog({
      title: _("optionAlert"),
      modal: true,
      buttons: buttons});
  });
  $('#checkRawMode').prop("checked",
    config.RawMode()).click(function () {
      config.Set("RawMode", $(this).prop("checked"));
    });
  $('#checkPunctuations').prop("checked",
    config.AddonPunctuations()).click(function () {
      config.Set("AddonPunctuations", $(this).prop("checked"));
    });
  $('#checkRelatedText').prop("checked",
    config.AddonRelatedText()).click(function () {
      config.Set("AddonRelatedText", $(this).prop("checked"));
    });

  // To set default check state of checkboxes, do call button("refresh").
  $('#checkDebugMessage').prop("checked",
    config.Debug()).click(function () {
      config.Set("Debug", $(this).prop("checked"));
  });

  let im_modules = jscin.getModuleNames();
  let def_module = config.DefaultModule();
  if (!im_modules.includes(def_module))
    def_module = jscin.getModule()?.name;
  assert(def_module, "Cannot find the default module.");

  let selectMod = $('#formSelectModule');
  selectMod.empty();

  for (let name of im_modules.filter((v)=>v.startsWith("Gen"))) {
    let opt = $('<option></option>').val(name).text(name);
    if (name == def_module)
      opt.attr("selected", "selected");
    selectMod.append(opt);
  }
  selectMod.selectmenu({change: (val) => {
    config.Set("DefaultModule", selectMod.val());
    alert(_("optionReloadExtensionOrRestart"));
  }});
  $('#formSelectModule').controlgroup();
  $('#start_dumb_ime').button();
  $('#start_test_area').button();
}

function removeFileExtension(filename) {
  return filename.split('.')[0];
}

function GuessNameFromURL(url) {
  const guess = removeFileExtension(url.split('\\').pop().split('/').pop().split('?')[0]);
  return guess || '<Unknown>';
}

async function addTableFromBlob(blob, source, type, save_name) {
  debug("addTableFromBlob", source, blob, type);

  if (source instanceof File) {
    source = source.name;
  }
  assert(typeof(source) === 'string', "Source must be either URL or File:", source);

  if (IsGTabBlob(blob)) {
    try {
      // No %ename from blob so let's "guess" from the URL name or the file
      // name.
      let ename = save_name || GuessNameFromURL(source);
      debug("Parsing GTAB into CIN:", source, ename);
      let cin = `%ename ${ename}\n` + parseGtab(blob);
      debug("Succesfully parsed a GTAB into CIN:", source, cin.substring(0,100).split('\n'));
      if (await addTable(cin, source, type, save_name)) {
        debug("addTableFromBlob: success.", source);
        return true;
      } else {
        debug("addTableFromBlob: Failed adding table:", source);
      }
    } catch (err) {
      warn("Failed to parse as GTAB from:", source, err);
    }
  }

  let t;
  for (let locale of ['utf-8', 'big5', 'gbk', 'gb18030', 'utf-16le', 'utf-16be']) {
    try {
      t = new TextDecoder(locale, {fatal: true}).decode(blob);
      break;
    } catch (err) {
      debug("Failed to decode CIN table:", source, locale);
    }
  }
  if (!t) {
    setAddTableStatus(_("tableStatusFailedParsingMsg", `Unknown format: ${source}`), true);
    debug("Failed to decode the table:", source);
  } else if (await addTable(t, source, type, save_name)) {
    debug("Succesfully added a table:", source, t.substring(0,100).split('\n'));
    return;
  } else {
    // addTable should already gave the error message.
    debug("Failed to parse and add the table:", source);
  }
}

async function addTableFromUrl(url, type, save_name, progress=true) {
  let name = save_name || GuessNameFromURL(url);
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
          let pct = Math.round(e.loaded / e.total * 100);
          setAddTableStatus(_("tableStatusDownloadingNamePct", [name, pct]), false);
        } else {
          setAddTableStatus(_("tableStatusDownloadingNameBytes", [name, e.loaded]), false);
        }
      }, false);
      xhr.addEventListener("load", (e)=> {
        setAddTableStatus(_("tableStatusDownloadedParseName", name), false);
        blob = e.currentTarget.response;
        addTableFromBlob(blob, url, type, save_name);
        delete table_loading[url];
      });
      xhr.onreadystatechange = (e) => {
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
      blob = await LoadArrayBuffer(url, true);
      setAddTableStatus(_("tableStatusDownloadedParseName", name), false);
      addTableFromBlob(blob, url, type, save_name);
      delete table_loading[url];
    }
  } catch (err) {
    delete table_loading[url];
    error("addTableFromUrl: error", url, err);
    setAddTableStatus(_("tableStatusDownloadFailNameStatus", [name, this.status]), true);
    return;
  }
}

async function addTableFromFile(files, type) {
  for (let f of files) {
    debug("addTableFromFile", f);
    let fr = new FileReader();
    fr.addEventListener("load", (event) => {
      addTableFromBlob(fr.result, f, type);
    });
    fr.addEventListener("error", (event) => {
      error("Failed loading file:", f);
    });

    // Trigger the read event.
    fr.readAsArrayBuffer(f);
  }
}

async function addTable(content, url, type, save_name) {

  // TODO(hungte) Parse using jscin.createTable
  // so we can better figure out the right name.
  // Parse the content
  let [success, cin, msg] = parseCin(content);

  if (!success) {
    // result is now the error message.
    setAddTableStatus(_("tableStatusFailedParsingMsg", msg), true);
    return false;
  }

  let name = save_name || cin.ename;
  let info = jscin.getTableInfo(name);
  if (info) {
    // TODO(hungte) Localize this.
    if (!confirm(`Do you wish to overwrite ${info.cname} / ${info.ename} ?`)) {
      setAddTableStatus(_("tableStatusNotAdded"), true);
      return false;
    } else {
      $(`#ime_${encodeId(name)}`).remove();
    }
  }

  let real_type = solveFileType(cin, type);
  debug("addTable: table type:", type, "=>", real_type);

  // Update the UI
  const new_name = await jscin.saveTable(save_name, cin, url, real_type);
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
  $('.optionBytesInUse').text(_("optionBytesInUse", `${bytes_in_use}`));
}

function setAddTableStatus(status, err) {
  let status_field = document.getElementById("add_table_status");
  status_field.innerText = status;
  status_field.className = err ? "status_error" : "status_ok";
}

function solveFileType(cin, type) {
  assert(type, "The type description must be provided.");
  if (!type.auto_detect)
    return type;

  let matched = undefined;
  let from_table = undefined;

  for (let opt of KnownTypes) {
    if (opt.from_table)
      from_table = opt;
    if (!opt.detect)
      continue;

    matched = opt;
    for (let [key, expected] of Object.entries(opt.detect)) {
      if (!(cin.chardef[key] &&
            cin.chardef[key].includes(expected))) {
        matched = null;
        break;
      }
    }
    if (matched) {
      debug("solveFileType: matched:", opt);
      break;
    }
  }
  let result = matched || from_table || type;
  assert(result, "There must be at least one type to match.");
  // Make a record so we can re-parse its type next time.
  result.auto_detect = true;
  return result;
}

function addTableToList(name, list_id, do_insert) {
  let info = jscin.getTableInfo(name);
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

  const item = $('<li class="ui-state-default"></li>').attr('id', id).text(
               `${display_name} ${builtin_desc}`);
  if (do_insert)
    $(list_id).prepend(item);
  else
    $(list_id).append(item);

  $(`#${id}`).prepend(icon).click(async function() {
    let table = {};
    if (!builtin)
      table = await jscin.loadTable(name);

    // `type` from table.type should remain the same (even if it's undefined) so
    // the behavior will be the same when being reloaded.
    let type = table.type;
    let type_label = [];
    if (type) {
      if (type.cname)
        type_label.push(`${type.cname} (${type.ename})`);
      if (type.auto_detect)
        type_label.push(_("optionTypeAuto"));
    }
    if (builtin)
      type_label.push(_("optionBuiltin"));

    $('.optionTableDetailName').text(display_name);
    $('.optionTableDetailSource').val(url);
    $('.optionTableDetailType').text(type_label.join(' '));
    $('#query_keystrokes').prop('checked', config.AddonCrossQuery() == name);

    let buttons = [{
      text: ' OK ',
      click: function () {
        config.Set("AddonCrossQuery",
          $('#query_keystrokes').is(':checked') ? name : "");
        $(this).dialog("close");
      } }];

    let ims = config.InputMethods();
    let keep = builtin || (ims.length == 1 && ims[0] == name);

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
          debug("optionReload:", type);
          if (confirm(_("optionAreYouSure"))) {
            // Reload is the only case we want to preserve the 'name'.
            addTableFromUrl(url, type, name);
          }
          $(this).dialog("close");
        }});
    }

    $('#table_detail_dialog').dialog({
      title: _("optionTableDetail"),
      minWidth: 600,
      buttons: buttons,
      modal: true
    });
  });
}

function loadTables() {
  let available = jscin.getTableNames();
  let enabled = config.InputMethods();

  // First make sure we've visited all in the 'enabled', so we have more chance
  // to see the available input methods even if table info list is out of sync.
  for (let name of enabled.filter((n) => available.includes(n))) {
    addTableToList(name, '#enabled_im_list');
  }
  // Next add anything available but not in the enabled.
  for (let name of available.filter((n) => !enabled.includes(n))) {
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
    for (let line of text.split('\n')) {
      let regex = /^ *(?<cin>[^\.]*\.cin),"(?<ename>[^(]*)\((?<cname>[^)]*)\)","(?<cdesc>[^;]*);?(?<edesc>.*)?"/;
      let v = line.match(regex)?.groups;
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
const KnownTypes = await LoadJSON("tables/types.json");

/* Export name for debugging. */
globalThis.jscin = jscin;
globalThis.options = {
  BuiltinIMs,
  KnownTypes,
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
