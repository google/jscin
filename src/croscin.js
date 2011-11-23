// Copyright 2011 Google Inc. All Rights Reserved.

/**
 * @fileoverview Croscin initialization code.
 * @author zork@google.com (Zach Kuznia)
 */

var kOptionsPage = "options";
var kMenuItems = [{
  "id": kOptionsPage,
  "label": "Options"
}];


ime_api.setMenuItems({"engineID": jscin.ENGINE_ID,
                      "items": kMenuItems})

ime_api.onMenuItemActivated.addListener(function(engineID, name) {
  if (name == kOptionsPage) {
    var options_url = chrome.extension.getURL("options.html");
    chrome.tabs.create({"url": options_url});
  }
});

