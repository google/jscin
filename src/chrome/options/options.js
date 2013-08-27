// Copyright 2011 Google Inc. All Rights Reserved.

/**
 * @fileoverview Options page for Chrome OS CIN.
 * @author zork@google.com (Zach Kuznia)
 */

var table_loading = {};

var kDefaultCinTableRadioName = "default_radio_name";
var kDefaultCinTableRadioId = "default_radio_";
var kDefaultCinTableDefault = "array30";

// this is dirty hack
var jscin = chrome.extension.getBackgroundPage().jscin;
var bgPage = chrome.extension.getBackgroundPage();

_ = chrome.i18n.getMessage;

function SetElementsText() {
  for (var i = 0; i < arguments.length; i++) {
    $("." + arguments[i]).text(_(arguments[i]));
  }
}

function init() {
  loadCinTables();
  SetElementsText("optionCaption", "optionInputMethodTables",
      "optionAddTables", "optionAddUrl", "optionAddFile", "optionAddDrive",
      "optionSaveToDrive", "optionSettingChoices",
      "optionDebug", "optionDebugMessage");
  $("#accordion").accordion({
    heightStyle: "content"
  });

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

  $('#debug_mode_input').button().click(function() {
    alert("Sorry, not supported yet.");
    // chrome.extension.getBackgroundPage().on_debug_mode_change(
    // $("#debug_mode_input").attr("checked"));
  });
  $('#start_dumb_ime').button();
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
    xhr.onreadystatechange = function () {
      if (this.readyState == 4) {
        if (this.status == 200) {
          addTable(this.responseText, url);
        } else {
          // Update the UI
          setAddTableStatus("Could not read url.  Server returned " + this.status,
                          true);
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
    if (addCinTable(parsed_data)) {
      // Update the UI
      addCinTableToTable(parsed_data.metadata);
      setAddTableStatus("Table added successfully", false);
      notifyConfigChanged();
      if ($('#save_to_drive').is(':checked')) {
        SaveToDrive(parsed_data.metadata.ename, content);
      }
      jscin.writeLocalStorage(jscin.kRawDataKeyPrefix + parsed_data.metadata.ename, content);
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
  var setting_options = JSON.parse(LoadExtensionResource("options/builtin_options.json"));
  var setting = setting_options[document.getElementById("add_table_setting").selectedIndex];
  return setting;
}

function addCinTable(data) {
  var metadata = jscin.getTableMetadatas()[data.metadata.ename];
  if (metadata) {
    if (!confirm("Do you wish to overwrite " + data.metadata.ename + "?")) {
      return false;
    } else {
      removeCinTableFromTable(data.metadata.ename);
    }
  }
  jscin.addTable(data.metadata.ename, data.metadata, data.data);
  return true;
}

function addCinTableToTable(metadata) {
  var name = metadata.ename;
  var cname = metadata.cname;
  var url = metadata.url;
  var builtin = metadata.builtin;

  var table = document.getElementById("cin_table_table");
  var rowLength = table.rows.length;

  var row = table.tBodies[0].insertRow(-1);
  if (rowLength % 2) {
    row.className = "even_row";
  }

  // Cell: (ename, cname)
  var cell = row.insertCell(-1);
  $(cell).text(name);
  var cell = row.insertCell(-1);
  $(cell).text(cname);

  // Cell: Default
  cell = row.insertCell(-1);
  var radio = document.createElement('input');
  radio.type = 'radio';
  radio.name = kDefaultCinTableRadioName;
  radio.id = kDefaultCinTableRadioId + name;
  radio.onclick = function () {
    jscin.setDefaultCinTable(name);
    notifyConfigChanged();
  }
  cell.appendChild(radio);

  // Cell: Remove button
  cell = row.insertCell(-1);
  if (true) {
    var button = document.createElement('input');
    button.type = 'button';
    if (builtin)
      button.value = 'Expire';
    else
      button.value = 'Remove';
    button.onclick = function () {
      jscin.deleteTable(name);
      notifyConfigChanged();
      table.tBodies[0].deleteRow(row.sectionRowIndex);

      if (jscin.getDefaultCinTable() == name) {
        setNewDefaultCinTable();
      }
    }
    cell.appendChild(button);
  }

  // Cell: Reload button
  cell = row.insertCell(-1);
  if (url) {
    var reload_button = document.createElement('input');
    reload_button.type = 'button';
    reload_button.value = 'Reload';
    reload_button.onclick = function () {
      jscin.deleteTable(name);
      notifyConfigChanged();
      table.tBodies[0].deleteRow(row.sectionRowIndex);
      if (jscin.getDefaultCinTable() == name) {
        jscin.setDefaultCinTable(kDefaultCinTableDefault);
        notifyConfigChanged();
        document.getElementById(kDefaultCinTableRadioId +
                                kDefaultCinTableDefault).checked = true;
      }
      addTableUrl(url, metadata.setting);
    }
    cell.appendChild(reload_button);
  }

  // Cell: Setting
  var setting = metadata.setting;
  cell = row.insertCell(-1);
  if (builtin) {
    $(cell).text("From Table");
  } else {
    $(cell).text(setting.ename + ' ' + setting.cname);
  }

  // Cell: Google Drive Link
  var link = metadata.link;
  cell = row.insertCell(-1);
  cell.id = 'drive_' + name;
  if (link) {
    $(cell).append($('<a>', { 'href': link, 'target': "_blank" }).text('Backup on Google Drive'));
  }

  // Cell: URL
  cell = row.insertCell(-1);
  if (builtin) {
    $(cell).text("(builtin)");
  } else if (url) {
    $(cell).text(url);
  }
}

function setNewDefaultCinTable() {
  var newDefaultCinTable;
  var metadatas = jscin.getTableMetadatas();
  // get the first table
  for (var table in metadatas) {
    newDefaultCinTable = metadatas[table].ename;
    break;
  }
  setDefaultCinTable(newDefaultCinTable);
}

function setDefaultCinTable(name) {
  jscin.setDefaultCinTable(name);
  notifyConfigChanged();
  document.getElementById(kDefaultCinTableRadioId + name).checked = true;
}

function removeCinTableFromTable(name, url) {
  var table = document.getElementById("cin_table_table");

  for (var i = 0; i < table.tBodies[0].rows.length; i++) {
    var row = table.tBodies[0].rows[i];
    if (row.cells[0].innerText == name) {
      table.tBodies[0].deleteRow(i);

      if (jscin.getDefaultCinTable() == name) {
        jscin.setDefaultCinTable(kDefaultCinTableDefault);
        notifyConfigChanged();
        document.getElementById(kDefaultCinTableRadioId +
                                kDefaultCinTableDefault).checked = true;
      }
      return;
    }
  }
}

function loadCinTables() {
  var metadatas = jscin.getTableMetadatas();
  for (var name in metadatas) {
    addCinTableToTable(metadatas[name]);
  }
  document.getElementById(kDefaultCinTableRadioId +
                          jscin.getDefaultCinTable()).checked = true;
}

function notifyConfigChanged() {
  chrome.extension.getBackgroundPage().on_config_changed();
}

$(init);
