// Copyright 2011 Google Inc. All Rights Reserved.

/**
 * @fileoverview Options page for Chrome OS CIN.
 * @author zork@google.com (Zach Kuznia)
 */

var table_loading = {};

// this is dirty hack
var bgPage = chrome.extension.getBackgroundPage();
var jscin = bgPage.jscin;
var instance = bgPage.croscin.instance;

_ = chrome.i18n.getMessage;

function SetElementsText() {
  for (var i = 0; i < arguments.length; i++) {
    $("." + arguments[i]).text(_(arguments[i]));
  }
}

function init() {
  SetElementsText("optionCaption", "optionInputMethodTables",
      "optionHowToEnableTables", "optionEnabledTables", "optionAvailableTables",
      "optionAddTables", "optionAddUrl", "optionAddFile", "optionAddDrive",
      "optionTableDetailNameHeader", "optionTableDetailSourceHeader",
      "optionTableDetailTypeHeader",
      "optionSaveToDrive", "optionSettingChoices",
      "optionDebug", "optionDebugMessage");


  $('#available_im_list').sortable({
    revert: true,
    connectWith: ".sortable",
    helper: 'clone'
  }).disableSelection();
  /* TODO(hungte) Reject when #enabled_im_list has nothing. */
  $('#enabled_im_list').sortable({
    revert: true,
    connectWith: ".sortable",
    cancel: "li:only-child",
    helper: 'clone',
    update: function (event, ui) {
      var new_list = []
      $('#enabled_im_list li').each(function(index) {
        new_list.push($(this).attr('id').replace(/^ime_/, ''));
      });
      updateEnabledList(new_list);
      notifyConfigChanged();
    }
  }).disableSelection();
  $("#accordion").accordion({heightStyle: "content"});

  loadCinTables();

  // TODO(hungte) we should autodetect again after source is specified.
  var select = $("#add_table_setting");
  var setting_options = JSON.parse(LoadExtensionResource("options/builtin_options.json"));
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
    width: 800,
    modal: true,
  });

  $(".optionAddUrl").button().click(function(event) {
    setAddTableStatus("");
    $("#file_div").hide();
    $("#url_div").show();
    $("#doc_div").hide();
    $("#save_to_drive_input").show();
    $("#add_table_dialog").dialog('option', 'buttons', [
      {
        text: _("optionAddTable"),
        click: function() {
          var url = document.getElementById("cin_table_url_input").value;
          var setting = getSettingOption();
          addTableUrl(url, setting);
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
    $("#save_to_drive_input").show();
    $("#add_table_dialog").dialog('option', 'buttons', [
      {
        text: _("optionAddTable"),
        click: function() {
          var files = document.getElementById("cin_table_file_input").files;
          var setting = getSettingOption();
          addTableFile(files, setting);
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

  $(".optionAddDrive").button().click(function(event) {
    setAddTableStatus("");
    $("#url_div").hide();
    $("#file_div").hide();
    $("#doc_div").show();
    setDocStatus("");
    $("#save_to_drive").prop('checked', false);
    $("#save_to_drive_input").hide();
    bgPage.oauth.authorize(function() {
      $('#doc_list').empty();
      getDocumentList("");
    });
    $("#add_table_dialog").dialog('option', 'buttons', [
      {
        text: "OK",
        click: function() {
          $(this).dialog("close");
          addTableDrive();
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

  $('#save_to_drive').change(function() {
    if ($('#save_to_drive').is(':checked')) {
      $('#auth_status').text("(Uncheck if you refuse to authenticate.)");
      bgPage.oauth.authorize(function() {
        $('#auth_status').text('(Successfully authenticated.)');
      });
    }
  });

  /* TODO(hungte) Can't find a way to set the default checked state of checkbox
   * debug_mode_input. Let's pretend it's same as the default value... */
  $('#debug_mode_input').button().prop("checked", instance.debug).
      button("refresh").click(function() {
    instance.on_debug_mode_change($('#debug_mode_input').prop("checked"));
  });
  $('#start_dumb_ime').button();
  $('#start_test_area').button();
}

function LoadExtensionResource(url) {
  var rsrc = chrome.extension.getURL(url);
  var xhr = new XMLHttpRequest();
  // self.log("croscin.LoadExtensionResource: " + url);
  xhr.open("GET", rsrc, false);
  xhr.send();
  if (xhr.readyState != 4 || xhr.status != 200) {
    // self.log("croscin.LoadExtensionResource: failed to fetch: " + url);
    return null;
  }
  return xhr.responseText;
}

function addTableUrl(url) {
  if (url.replace(/^\s+|s+$/g, "") == "") {
    setAddTableStatus("URL is empty", true);
    return;
  }

  if (table_loading[url]) {
    setAddTableStatus("Table is loading", false);
  } else {
    table_loading[url] = true;

    setAddTableStatus("Loading...", false);
    var xhr = new XMLHttpRequest();
    xhr.addEventListener("progress", function(evt) {
      if (evt.lengthComputable && evt.total > 0) {
        var percentComplete = evt.loaded / evt.total;
        // TODO(hungte) Complete the progress bar stuff.
        // $('#progressbar').progressbar({value: percentComplete});
      } else {
        // $('#progressbar').progressbar({value: false});
      }
    }, false);
    xhr.onreadystatechange = function () {
      if (this.readyState == 4) {
        if (this.status == 200) {
          addTable(this.responseText, url);
        } else {
          // Update the UI
          setAddTableStatus("Could not read url.  Server returned " +
                            this.status, true);
        }
        delete table_loading[url];
      }
    }
    xhr.open("GET", url, true);
    xhr.send(null);
  }
}

function addTableFile(files) {
  for (var i = 0, file; file = files[i]; i++) {
    var reader = new FileReader();

    reader.onload = function(e) {
      addTable(e.target.result);
    };

    reader.readAsText(file);
  }
}

function addTableDrive(docs) {
  var doc;
  for (var i = 0; doc = docs[i]; ++i) {
    if ($('#radio' + i).is(':checked')) {
      break;
    }
  }
  addTableUrl(doc.entry.content.src + '&format=txt', getSettingOption());
}

function addTable(content, url) {
  // Parse the entry
  var parsed_result = parseCin(content);
  if (parsed_result[0]) {
    var parsed_data = parsed_result[1];
    writeSettingToData(getSettingOption(), parsed_data);
    if (typeof url !== undefined) {
      parsed_data.metadata.url = url;
    }
    if (installCinTable(parsed_data, content)) {
      // Update the UI
      addCinTableToList(parsed_data.metadata, '#enabled_im_list');
      setAddTableStatus("Table added successfully", false);
      notifyConfigChanged();
      if ($('#save_to_drive').is(':checked')) {
        SaveToDrive(parsed_data.metadata.ename, content);
      }
    } else {
      setAddTableStatus("Table not added", true);
    }
  } else {
    var msg = parsed_result[1];
    // Update the UI
    setAddTableStatus("Could not parse cin file. " + msg, true);
  }
}

function setAddTableStatus(status, error) {
  var status_field = document.getElementById("add_table_status");
  status_field.innerText = status;
  if (error) {
    status_field.className = "status_error";
  } else {
    status_field.className = "status_ok";
  }
}

function writeSettingToData(setting, parsed_data) {
  parsed_data.metadata.setting = setting;
  for (var option in setting.options) {
    parsed_data.data[option] = setting.options[option];
  }
}

function getSettingOption() {
  var setting_options = JSON.parse(
      LoadExtensionResource("options/builtin_options.json"));
  var setting = setting_options[
      document.getElementById("add_table_setting").selectedIndex];
  return setting;
}

function installCinTable(data, raw_content) {
  var metadata = jscin.getTableMetadatas()[data.metadata.ename];
  if (metadata) {
    if (!confirm("Do you wish to overwrite " + data.metadata.ename + "?")) {
      return false;
    } else {
      $('#ime_' + data.metadata.ename).remove();
    }
  }
  jscin.addTable(data.metadata.ename, data.metadata, data.data);
  // TODO(hungte) Move this to jscin.addTable.
  jscin.writeLocalStorage(jscin.kRawDataKeyPrefix + data.metadata.ename,
                          raw_content);
  instance.prefAddEnabledInputMethod(data.metadata.ename);
  return true;
}

function addCinTableToList(metadata, list_id) {
  var ename = metadata.ename;
  var cname = metadata.cname;
  var url = metadata.url;
  var builtin = metadata.builtin;
  var setting = metadata.setting;
  var id = 'ime_' + ename;
  var icon= '<span class="ui-icon ui-icon-arrowthick-2-n-s">';

  var display_name = cname + ' (' + ename + ')';
  var builtin_desc = builtin ? ' [' + _("optionBuiltin") + ']' : "";

  $(list_id).append(
      $('<li class="ui-state-default"></li>').attr('id', id).text(
          display_name + builtin_desc));

  // TODO(hungte) Show details and dialog to edit this table.
  $('#' + id).prepend(icon).click(
      function() {
        $('.optionTableDetailName').text(display_name);
        $('.optionTableDetailSource').text(builtin ? _("optionBuiltin") : url);
        $('.optionTableDetailType').text(setting ? setting.ename :
          _("optionBuiltin"));
        var buttons = [ { text: ' OK ',
          click: function () {
            $(this).dialog("close");
          } } ];

        if (!builtin) {
          // TODO(hungte) We should not allow removing active IME.
          buttons.push( { text: _('optionRemove'),
            click: function () {
              if (confirm(_("optionAreYouSure"))) {
                removeCinTable(ename);
                $('#' + id).remove();
                notifyConfigChanged();
              }
              $(this).dialog("close");

            } }, { text: _('optionReload'),
            click: function() {
              if (confirm(_("optionAreYouSure"))) {
                removeCinTable(ename);
                $('#' + id).remove();
                addTableUrl(url, metadata.setting);
                notifyConfigChanged();
              }
              $(this).dialog("close");

            } });

          var raw_content = jscin.readLocalStorage(
              jscin.kRawDataKeyPrefix + metadata.ename, null);
          if (raw_content) {
            buttons.push( { text: _('optionBackupToDrive'),
            click: function () {
              if (confirm(_("optionAreYouSure"))) {
                SaveToDrive(metadata.ename, raw_content);
              }
              $(this).dialog("close");
            } });
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
  var tables = instance.pref_im_enabled_list;
  tables.forEach(function (name) {
    addCinTableToList(metadatas[name], '#enabled_im_list');
  });
  for (var name in metadatas) {
    if (tables.indexOf(name) < 0) {
      addCinTableToList(metadatas[name], '#available_im_list');
    }
  }
}

function removeCinTable(name) {
  console.log('removeCinTable: ' + name);
  instance.prefRemoveEnabledInputMethod(name);
  jscin.deleteTable(name);
}

function notifyConfigChanged() {
  instance.on_config_changed();
}

function updateEnabledList(enabled) {
  instance.prefSetEnabledList(enabled);
}

$(init);
