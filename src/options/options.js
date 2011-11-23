// Copyright 2011 Google Inc. All Rights Reserved.

/**
 * @fileoverview Options page for Chrome OS CIN.
 * @author zork@google.com (Zach Kuznia)
 */

var kTableUrlsKey = "table_urls";

function init() {
  loadTableUrls();
}

function addTableUrl() {
  var url = document.getElementById("cin_table_url_input").value;

  var table_urls = readLocalStorage(kTableUrlsKey, {});

  if (table_urls[url]) {
    setAddUrlStatus("URL already exists", true);
  } else {
    // Write a placeholder value.
    table_urls[url] = {};
    writeLocalStorage(kTableUrlsKey, table_urls);

    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function () {
      if (this.readyState == 4) {
        if (this.status == 200) {
          // Parse the entry
          var parsed_data = parseCin(this.responseText);
          if (parsed_data) {
            // Update the entry in localStorage
            var table_urls = readLocalStorage(kTableUrlsKey, {});
            table_urls[url]["data"] = parsed_data;
            writeLocalStorage(kTableUrlsKey, table_urls);

            // Update the UI
            addTableUrlToTable(url);
            setAddUrlStatus("OK", false);
          } else {
            // Update the entry in localStorage
            deleteTableUrl(url);

            // Update the UI
            setAddUrlStatus("Could not parse cin file.", true);
          }
        } else {
          // Update the entry in localStorage
          deleteTableUrl(url);

          // Update the UI
          setAddUrlStatus("Could not read url.  Server returned " + this.status,
                          true);
        }
      }
    }
    xhr.open("GET", url, true);
    xhr.send(null);
  }
}

function deleteTableUrl(url) {
  var table_urls = readLocalStorage(kTableUrlsKey);
  delete table_urls[url];
  writeLocalStorage(kTableUrlsKey, table_urls);
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

function addTableUrlToTable(url) {
  var table = document.getElementById("cin_table_url_table");

  var row = table.tBodies[0].insertRow(-1);
  var cell = row.insertCell(-1);
  cell.innerHTML = url;
  var cell = row.insertCell(-1);
  var button = document.createElement('input');
  button.type = 'button';
  button.value = 'Remove';
  button.onclick = function () {
    deleteTableUrl(url);
    table.tBodies[0].deleteRow(row.sectionRowIndex);
  }
  cell.appendChild(button);
}

function loadTableUrls() {
  var table_urls = readLocalStorage(kTableUrlsKey);
  if (table_urls) {
    for (table_url in table_urls) {
      addTableUrlToTable(table_url);
    }
  }
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
}
