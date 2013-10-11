/**
 * @fileoverview Description of this file.
 */

var _ = chrome.i18n.getMessage;
var bgPage = chrome.extension.getBackgroundPage();

function BuildKbMenu() {
  var kb_ids = [
      "KB_DEFAULT",
      "KB_HSU",
      "KB_IBM",
      "KB_GIN_YIEH",
      "KB_ET",
      "KB_ET26",
      "KB_DVORAK",
      "KB_DVORAK_HSU",
      "KB_DACHEN_CP26",
      "KB_HANYU_PINYIN",
      "KB_THL_PINYIN",
      "KB_MPS2_PINYIN"
  ];
  var menu = $('#kb_menu');
  var current_value = bgPage.GetKeyboardLayout();
  menu.empty();
  kb_ids.forEach(function (id) {
    var opt = $('<option/>').text(_(id)).val(id);
    if (id == current_value)
      opt.prop("selected", true);
    menu.append(opt);
  });
  menu.change(function (ev) {
    bgPage.SetKeyboardLayout(ev.target.value);
  });
}

function init() {
  $('#accordion').accordion();
  BuildKbMenu();
}

$(init);
