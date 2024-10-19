// Copyright 2011 Google Inc. All Rights Reserved.

/**
 * @fileoverview Options page for Chrome OS CIN.
 * @author zork@google.com (Zach Kuznia)
 */

import { $, jQuery } from "../jquery/jquery-ui.js";
import { parseGtab, IsGTabBlob } from "../jscin/gtab_parser.js";
import { parseCin } from "../jscin/cin_parser.js";
import { Config, LoadResource } from "../config.js";

import { AddLogger } from "../jscin/logger.js";
const {log, debug, info, warn, error, assert, trace, logger} = AddLogger("option");

var table_loading = {};
var config = new Config();
await config.Load();

// this is dirty hack
var bgPage = chrome.extension.getBackgroundPage();
var jscin = bgPage.jscin;
var instance = bgPage.croscin.instance;

if (config.Debug()) {
  logger.enable();
  window.bgPage = bgPage;
  window.config = config;
  window.logger = logger;
}

var _ = chrome.i18n.getMessage;

function SetElementsText(...args) {
  for (let name of args) {
    $("." + name).text(_(name));
  }
}

var BuiltinIMs = JSON.parse(await LoadResource("tables/builtin.json"));
var BuiltinOptions = JSON.parse(await LoadResource("options/builtin_options.json"));

function encodeId(name) {
  let v = name.split("").map((v)=>v.charCodeAt().toString(16)).join('');
  return v;
}

function decodeId(id) {
  return id.match(/.{2}/g).map((v)=>String.fromCharCode(parseInt(v, 16))).join('');
}

async function init() {
  SetElementsText("optionCaption", "optionInputMethodTables",
      "optionHowToEnableTables", "optionEnabledTables", "optionAvailableTables",
      "optionAddTables", "optionAddUrl", "optionAddFile",
      "optionTableDetailNameHeader", "optionTableDetailSourceHeader",
      "optionTableDetailTypeHeader", "optionQueryKeystrokes",
      "optionSettingChoices",
      "optionGeneral", "optionSupportNonChromeOS",
      "optionAlertChangeSupportNonChromeOS",
      "optionRelatedText", "optionPunctuations",
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
      var new_list = [];
      $('#enabled_im_list li').each(function(index) {
        new_list.push(decodeId($(this).attr('id').replace(/^ime_/, '')));
      });
      config.Set("InputMethods", new_list);
    }
  }).disableSelection();
  $("#accordion").accordion({heightStyle: "content"});

  loadCinTables();

  // TODO(hungte) we should autodetect again after source is specified.
  var select = $("#add_table_setting");
  var setting_options = JSON.parse(await LoadResource("options/builtin_options.json"));
  select.empty();
  for (var i in setting_options) {
    var setting = setting_options[i];
    var option = $("<option>", {"id": "option" + i});
    option.text(setting.ename + ' ' + setting.cname);
    if ("default" in setting && setting["default"]) {
      option.attr("selected", "selected");
    }
    select.append(option);
  }

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

    $("#add_table_dialog").dialog('option', 'buttons', [
      {
        text: _("optionAddTable"),
        click: function() {
          var url = document.getElementById("cin_table_url_input").value;
          addTableUrl(url);
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

  $(".optionAddFile").button().click(function(event) {
    setAddTableStatus("");
    $("#file_div").show();
    $("#url_div").hide();
    $("#doc_div").hide();

    $("#add_table_dialog").dialog('option', 'buttons', [
      {
        text: _("optionAddTable"),
        click: function() {
          var files = document.getElementById("cin_table_file_input").files;
          addTabFile(files);
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

  function SameWidth(e1, e2) {
    const w = Math.max(e1.width(), e2.width());
    e1.width(w);
    e2.width(w);
  }
  SameWidth($(".optionAddUrl"), $(".optionAddFile"));

  $('#checkSupportNonChromeOS').prop("checked",
    config.Emulation()).click(function ()
  {
    config.Set("Emulation", $(this).prop("checked"));
    var buttons = {};
    buttons[_("optionOK")] = function () {
      $(this).dialog("close");
    };
    $('#dialog_alert_change_support_non_chromeos').dialog({
      title: _("optionAlert"),
      modal: true,
      buttons: buttons});
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
  var module_form = $('#formSelectModule');
  var def_module = instance.getDefaultModule();
  module_form.empty();
  var im_modules = instance.getAvailableModules();
  im_modules.forEach(function (name) {
    if (!name.startsWith("Gen"))
      return;
    module_form.append(
        $('<input type=radio class=radio name=moduleRadio/>').attr("id", name).
        click(function () {
          instance.setDefaultModule(name);
          alert(_("optionReloadExtensionOrRestart"));
        }));
    module_form.append($('<label/>').attr("for", name).text(name));
  });
  $('#' + def_module).prop("checked", true);
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

function addTableFromBlob(blob, source) {
  debug("addTableFromBlob", source, blob);

  if (source instanceof File) {
    source = source.name;
  }
  assert(typeof(source) === 'string', "Source must be either URL or File:", source);

  if (IsGTabBlob(blob)) {
    try {
      // No %ename from blob so let's "guess" from the URL name or the file
      // name.
      let ename = GuessNameFromURL(source);
      debug("Parsing GTAB into CIN:", source, ename);
      let cin = `%ename ${ename}\n` + parseGtab(blob);
      debug("Succesfully parsed a GTAB into CIN:", source, cin.substring(0,100).split('\n'));
      if (addTable(cin)) {
        debug("addTableFromBlob: success.", source);
        return true;
      } else {
        debug("addTableFromBlob: Failed adding table:", source);
      }
    } catch (err) {
      warn("Failed to parse as GTAB from:", source, err);
    }
  }

  for (let locale of ['utf-8', 'big5', 'gbk', 'gb18030', 'utf-16le', 'utf-16be']) {
    try {
      let t = new TextDecoder(locale, {fatal: true}).decode(blob);
      addTable(t, source);
      debug("Succesfully added a table:", source, locale, t.substring(0,100).split('\n'));
      return;
    } catch (err) {
      debug("Failed to parse CIN file:", source, locale);
    }
  }
}

async function addTableUrl(url, progress=true) {
  let name = GuessNameFromURL(url);
  debug("addTableUrl:", name, url);
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
        addTableFromBlob(blob, url);
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
      blob = await LoadResource(url, true);
      setAddTableStatus(_("tableStatusDownloadedParseName", name), false);
      addTableFromBlob(blob, url);
      delete table_loading[url];
    }
  } catch (err) {
    delete table_loading[url];
    error("addTabUrl: error", url, err);
    setAddTableStatus(_("tableStatusDownloadFailNameStatus", [name, this.status]), true);
    return;
  }
}

async function addTabFile(files) {
  for (let f of files) {
    debug("addTabFile", f);
    let fr = new FileReader();
    fr.addEventListener("load", (event) => {
      addTableFromBlob(fr.result, f);
    });
    fr.addEventListener("error", (event) => {
      error("Failed loading file:", f);
    });

    // Trigger the read event.
    fr.readAsArrayBuffer(f);
  }
}

function addTable(content, url) {
  // Parse the entry
  var result = parseCin(content);
  var name;
  if (result[0]) {
    var data = result[1];
    name = data.metadata.ename;
    var metadata = jscin.getTableMetadatas()[name];
    if (metadata) {
      if (!confirm("Do you wish to overwrite " + data.metadata.ename + "?")) {
        setAddTableStatus(_("tableStatusNotAdded"), true);
        return false;
      } else {
        $('#ime_' + encodeId(name)).remove();
      }
    }
    // install_input_method will parse raw content again...
    result = jscin.install_input_method(name, content,
        { setting: getSettingOption(data), url: url });
  }
  // Update the UI
  if (result[0]) {
    // We must reload metadata, since it may be modified in
    // jscin.install_input_method.
    var metadata = jscin.getTableMetadatas()[name];
    addCinTableToList(name, metadata, '#enabled_im_list', true);
    setAddTableStatus(_("tableStatusAddedName", name), false);
    config.InsertInputMethod(name);
    return true;
  } else {
    var msg = result[1];
    setAddTableStatus(_("tableStatusFailedParsingMsg", msg), true);
    return false;
  }
}

function setAddTableStatus(status, err) {
  var status_field = document.getElementById("add_table_status");
  status_field.innerText = status;
  if (err) {
    status_field.className = "status_error";
  } else {
    status_field.className = "status_ok";
  }
}

function getSettingOption(data) {
  var setting_options = BuiltinOptions;
  var setting = setting_options[
      document.getElementById("add_table_setting").selectedIndex];
  if (setting.auto_detect) {
    var matched = undefined;
    var from_table = undefined;
    setting_options.forEach(function (opt) {
      if (opt.from_table)
        from_table = opt;
      if (!opt.detect || matched)
        return;

      for (var key in opt.detect) {
        if (!data.data.chardef[key] ||
            !data.data.chardef[key].includes(opt.detect[key]))
          return;
      }
      debug("getSettingOption: matched:", opt);
      matched = opt;
    });
    var result = matched || from_table || setting;
    // Make a record so we can re-parse its setting next time.
    result.by_auto_detect = true;
    return result;
  }
  return setting;
}

function addCinTableToList(name, metadata, list_id, do_insert) {
  var ename = metadata.ename;
  var cname = metadata.cname;
  var module = metadata.module;
  var url = metadata.url || '';
  // TODO(hungte) ename or name?
  var builtin = metadata.builtin && (metadata.ename in BuiltinIMs);
  var setting = metadata.setting;
  // id must be safe for jQuery expressions.
  var id = `ime_${encodeId(name)}`;
  var icon= '<span class="ui-icon ui-icon-arrowthick-2-n-s">';

  var display_name = cname + ' (' + ename + ')';
  var builtin_desc = builtin ? ' [' + _("optionBuiltin") + ']' : "";

  var item = $('<li class="ui-state-default"></li>').attr('id', id).text(
               display_name + builtin_desc);
  if (do_insert)
    $(list_id).prepend(item);
  else
    $(list_id).append(item);

  var setting_display_name = (
      setting ? (setting.cname || "") + " (" + (setting.ename || "") + ")" +
                (setting.by_auto_detect ? " " + _("optionTypeAuto") : ""):
      _("optionBuiltin"));

  // TODO(hungte) Show details and dialog to edit this table.
  $('#' + id).prepend(icon).click(
      function() {
        $('.optionTableDetailName').text(display_name);
        $('.optionTableDetailSource').val(builtin ? _("optionBuiltin") : url);
        $('.optionTableDetailType').text(setting_display_name);
        $('#query_keystrokes').prop('checked', jscin.getCrossQuery() == name);

        var buttons = [{
          text: ' OK ',
          click: function () {
            if($('#query_keystrokes').is(':checked')) {
              jscin.setCrossQuery(name);
            } else {
              if(jscin.getCrossQuery() == name) {
                jscin.setCrossQuery('');
              }
            }
            $(this).dialog("close");
          } }];

        /* Currently we expect at least one IM is enabled. */
        if (!builtin && config.InputMethods().length > 1) {
          // TODO(hungte) We should not allow removing active IME.
          buttons.push( { text: _('optionRemove'),
            click: function () {
              if (confirm(_("optionAreYouSure"))) {
                removeCinTable(name);
                $('#' + id).remove();
              }
              $(this).dialog("close");

            } });
        }

        if (!builtin) {
          if (url.includes('://')) {
            buttons.push({
              text: _('optionReload'),
              click: function() {
                debug("optionReload:", metadata);
                if (confirm(_("optionAreYouSure"))) {
                  addTableUrl(url, metadata.setting);
                }
                $(this).dialog("close");
              }});
          }
        }
        $('#table_detail_dialog').dialog({
          title: _("optionTableDetail"),
          minWidth: 600,
          buttons: buttons,
          modal: true
        });
      });
}

function loadCinTables() {
  var metadatas = jscin.getTableMetadatas();
  var tables = config.InputMethods();
  tables.forEach(function (name) {
    addCinTableToList(name, metadatas[name], '#enabled_im_list');
  });
  for (var name in metadatas) {
    if (!tables.includes(name)) {
      addCinTableToList(name, metadatas[name], '#available_im_list');
    }
  }
}

function removeCinTable(name) {
  debug('removeCinTable:', name);
  if(jscin.getCrossQuery() == name) {
    jscin.setCrossQuery('');
  }
  config.RemoveInputMethod(name);
  jscin.deleteTable(name);
}

$(init);
