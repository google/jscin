// Copyright 2013 Google Inc. All Rights Reserved.
/**
 * @fileoverview Implementation of IME menu for page-action.
 * @author hungte@google.com (Hung-Te Lin)
 */

import { $, jQuery } from "../jquery/jquery.js";

$(function() {
  let bgpage = chrome.extension.getBackgroundPage();
  let ime_api = bgpage.croscin.instance.ime_api;
  if (!ime_api.onUiMenu) {
    return;
  }

  ime_api.onUiMenu.addListener(function (engine) {
    let ui = $('#menu');
    ui.empty();
    engine.menuitems.forEach(function (item) {
      const label = item.label || item.id;
      ui.append(
          $('<div/>',  {text: label, 'class': item.checked ? "active" : ""})
          .click(function () {
            ime_api.dispatchEvent(
                'MenuItemActivated', engine.engineID,
                engine.menuitems[$(this).index()].id);
          }));
    });
  });

  ime_api.dispatchEvent('Activate', 'reload-menu');
});
