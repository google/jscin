// Copyright 2011 Google Inc. All Rights Reserved.

/**
 * @fileoverview Options page for Chrome OS CIN.
 * @author zork@google.com (Zach Kuznia)
 */

var kTableLoading = "loading";
var kTableMetadataKey = "table_metadata";
var kTableDataKeyPrefix = "table_data-";
var kDefaultCinTableKey = "default_cin_table";

var kDefaultCinTableRadioName = "default_radio_name";
var kDefaultCinTableRadioId = "default_radio_";
var kDefaultCinTableDefault = "predefined-array30";

function init() {
  writeLocalStorage(kTableLoading, {});
  loadCinTables();
  document.getElementById("cin_table_file_input").addEventListener(
      'change', addTableFile, false);
}

function onDebugModeChange() {
  var value = document.getElementById("debug_mode_input").checked;
  chrome.extension.getBackgroundPage().on_debug_mode_change(value);
}

function onAddTableUrl() {
  var url = document.getElementById("cin_table_url_input").value;
  addTableUrl(url);
}

function addTableUrl(url) {
  if (url.replace(/^\s+|s+$/g, "") == "") {
    setAddUrlStatus("URL is empty", true);
    return;
  }

  var table_metadata = readLocalStorage(kTableMetadataKey, {});
  var table_loading = readLocalStorage(kTableLoading, {});

  if (table_loading[url]) {
    setAddUrlStatus("Table is loading", false);
  } else {
    // Write a placeholder value.
    table_loading[url] = true;
    writeLocalStorage(kTableLoading, table_loading);

    setAddUrlStatus("Loading...", false);
    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function () {
      if (this.readyState == 4) {
        if (this.status == 200) {
          // Parse the entry
          var parsed_result = parseCin(this.responseText);
          if (parsed_result[0]) {
            var parsed_data = parsed_result[1];
            parsed_data.metadata.url = url;
            if (addCinTable(parsed_data)) {
              // Update the UI
              addCinTableToTable(parsed_data.metadata);
              setAddUrlStatus("OK", false);
            } else {
              setAddUrlStatus("Table not added", true);
            }
          } else {
            var msg = parsed_result[1];
            // Update the UI
            setAddUrlStatus("Could not parse cin file. " + msg, true);
          }
        } else {
          // Update the UI
          setAddUrlStatus("Could not read url.  Server returned " + this.status,
                          true);
        }
        table_loading = readLocalStorage(kTableLoading, {});
        delete table_loading[url];
        writeLocalStorage(kTableLoading, table_loading);
      }
    }
    xhr.open("GET", url, true);
    xhr.send(null);
  }
}

function addTableFile(evt) {
  var files = evt.target.files;

  for (var i = 0, file; file = files[i]; i++) {
    var reader = new FileReader();

    reader.onload = (function(file_data) {
      return function(e) {
        // Parse the entry
        var parsed_result = parseCin(e.target.result);
        if (parsed_result[0]) {
          var parsed_data = parsed_result[1];
          if (addCinTable(parsed_data)) {
            // Update the UI
            addCinTableToTable(parsed_data.metadata);
            setAddFileStatus("OK", false);
          } else {
            setAddFileStatus("Table not added", true);
          }
        } else {
          var msg = parsed_result[1];
          // Update the UI
          setAddFileStatus("Could not parse cin file. " + msg, true);
        }
      };
    })(file);

    reader.readAsText(file);
  }
}

function addCinTable(data) {
  // Update the entry in localStorage
  var table_metadata = readLocalStorage(kTableMetadataKey, {});

  if (table_metadata[data.metadata.ename] != undefined) {
    if (!confirm("Do you wish to overwrite " + data.metadata.ename + "?")) {
      return false;
    } else {
      removeCinTableFromTable(data.metadata.ename);
    }
  }
  table_metadata[data.metadata.ename] = data.metadata;
  writeLocalStorage(kTableMetadataKey, table_metadata);
  writeLocalStorage(kTableDataKeyPrefix + data.metadata.ename, data.data);
  return true;
}

function deleteCinTable(name) {
  var table_metadata = readLocalStorage(kTableMetadataKey, {});
  delete table_metadata[name];
  deleteLocalStorage(kTableDataKeyPrefix + name);
  writeLocalStorage(kTableMetadataKey, table_metadata);
}

function setAddUrlStatus(status, error) {
  var status_field = document.getElementById("add_url_status");
  status_field.innerHTML = status;
  if (error) {
    status_field.className = "status_error";
  } else {
    status_field.className = "status_ok";
  }
}

function setAddFileStatus(status, error) {
  var status_field = document.getElementById("add_file_status");
  status_field.innerHTML = status;
  if (error) {
    status_field.className = "status_error";
  } else {
    status_field.className = "status_ok";
  }
}

function addCinTableToTable(metadata) {
  var name = metadata.ename;
  var cname = metadata.cname;
  var url = metadata.url;
  var builtin = metadata.builtin;

  var table = document.getElementById("cin_table_table");

  var row = table.tBodies[0].insertRow(-1);

  // Cell: (ename, cname)
  var cell = row.insertCell(-1);
  cell.innerHTML = name;
  var cell = row.insertCell(-1);
  cell.innerHTML = cname;

  // Cell: Default
  cell = row.insertCell(-1);
  var radio = document.createElement('input');
  radio.type = 'radio';
  radio.name = kDefaultCinTableRadioName;
  radio.id = kDefaultCinTableRadioId + name;
  radio.onclick = function () {
    setDefaultCinTable(name);
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
      deleteCinTable(name);
      table.tBodies[0].deleteRow(row.sectionRowIndex);

      if (getDefaultCinTable() == name) {
        setDefaultCinTable(kDefaultCinTableDefault);
        document.getElementById(kDefaultCinTableRadioId +
                                kDefaultCinTableDefault).checked = true;
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
      deleteCinTable(name);
      table.tBodies[0].deleteRow(row.sectionRowIndex);
      if (getDefaultCinTable() == name) {
        setDefaultCinTable(kDefaultCinTableDefault);
        document.getElementById(kDefaultCinTableRadioId +
                                kDefaultCinTableDefault).checked = true;
      }
      addTableUrl(url);
    }
    cell.appendChild(reload_button);
  }

  // Cell: URL
  cell = row.insertCell(-1);
  if (builtin) {
    cell.innerHTML = "(builtin)";
  } else if (url) {
    cell.innerHTML = url;
  }
}

function removeCinTableFromTable(name, url) {
  var table = document.getElementById("cin_table_table");

  for (var i = 0; i < table.tBodies[0].rows.length; i++) {
    var row = table.tBodies[0].rows[i];
    if (row.cells[0].innerHTML == name) {
      table.tBodies[0].deleteRow(i);

      if (getDefaultCinTable() == name) {
        setDefaultCinTable(kDefaultCinTableDefault);
        document.getElementById(kDefaultCinTableRadioId +
                                kDefaultCinTableDefault).checked = true;
      }
      return;
    }
  }
}

function setDefaultCinTable(name) {
  writeLocalStorage(kDefaultCinTableKey, name);
}

function getDefaultCinTable() {
  return readLocalStorage(kDefaultCinTableKey, kDefaultCinTableDefault);
}

function loadCinTables() {
  var table_metadata = readLocalStorage(kTableMetadataKey);
  if (table_metadata) {
    for (table_name in table_metadata) {
      addCinTableToTable(table_metadata[table_name]);
    }
  }
  document.getElementById(kDefaultCinTableRadioId +
                          getDefaultCinTable()).checked = true;
}

function notifyConfigChanged() {
  chrome.extension.getBackgroundPage().on_config_changed();
}

function readLocalStorage(key, default_value) {
  var data = localStorage[key];
  if (!data) {
    return default_value;
  }
  return JSON.parse(data);
}

function writeLocalStorage(key, data) {
  localStorage[key] = JSON.stringify(data);
  notifyConfigChanged();
}

function deleteLocalStorage(key) {
  delete localStorage[key];
}
