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
    table_urls[url] = {"url": url};
    writeLocalStorage(kTableUrlsKey, table_urls);
    addTableUrlToTable(url);
    setAddUrlStatus("OK", false);
  }
}

function setAddUrlStatus(status, error) {
  var status_field = document.getElementById("add_url_status");
  status_field.innerHTML = status;
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
    var table_urls = readLocalStorage(kTableUrlsKey);
    delete table_urls[url];
    writeLocalStorage(kTableUrlsKey, table_urls);
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
