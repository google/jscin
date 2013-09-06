/**
 * @fileoverview Description of this file.
 */
$(function() {
  var bgpage = chrome.extension.getBackgroundPage();
  var ime_api = bgpage.croscin.instance.ime_api;
  if (!ime_api.onUiMenu) {
    return;
  }

  ime_api.onUiMenu.addListener(function (engine) {
    console.log("got onUiMenu", arguments);
    var ui = $('#menu');
    ui.empty();
    engine.menuitems.forEach(function (item) {
      var label = item.label || item.id;
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
