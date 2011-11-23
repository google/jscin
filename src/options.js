// Copyright 2011 Google Inc. All Rights Reserved.

/**
 * @fileoverview Options page for Chrome OS CIN.
 * @author zork@google.com (Zach Kuznia)
 */

var kTableUrlsKey = "table_urls";

function init() {
}

function addTableUrl() {
  var url = document.getElementById("cin_table_url_input").value;

  var table_urls = localStorage[kTableUrlsKey];
  if (!table_urls) {
    localStorage[kTableUrlsKey] = {};
    table_urls = localStorage[kTableUrlsKey];
  }

  if (table_urls[url]) {
    setAddUrlStatus("URL already exists", true);
  } else {
    table_urls[url] = {};
    addTableUrlToTable(url);
    setAddUrlStatus("OK", false);
  }
}

function setAddUrlStatus(status, error) {
  var status_field = document.getElementById("add_url_status");
  status_field.innerHTML = status;

  setTimeout(function() {
    status_field.innerHTML = "";
  }, 750);
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
    delete localStorage[kTableUrlsKey][url];
    table.tBodies[0].deleteRow(row.sectionRowIndex);
  }
  cell.appendChild(button);
}

function loadTableUrls() {
  var table_urls = localStorage[kTableUrlsKey];
  if (table_urls) {
    for (table_url in table_urls) {
      addTableUrlToTable(table_url);
    }
  }
}
