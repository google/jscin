// Copyright 2013 Google Inc. All Rights Reserved.

/**
 * @fileoverview IME UI implementation for chrome.input.ime.
 * @author hungte@google.com (Hung-Te Lin)
 */

var _debug = false;

function debug() {
  if (!_debug)
    return;
  console.log.apply(console, arguments);
}

$(function() {
  debug("ime.js started:", window.location.href);

  var ipc = new ImeEvent.ImeExtensionIPC('iframe');
  ipc.attach();
  ipc.recv(function (type, arg) {
    var engine = arg;
    var context =arg;

    debug('<iframe>', type, arg);

    // http://stackoverflow.com/questions/8039182/matching-jquery-text-to-nbsp
    var nbsp = '\xa0';

    if (type == 'UiMenu') {
      debug("render", type);
      var ui = $('#imePanel #menu');
      if (!ui)
        return;
      debug(ui);
      ui.empty();
      engine.menuitems.forEach(function (item) {
        debug("item", item);
        var label = item.label || item.id;
        ui.append(
            $('<div/>',  {text: label, 'class': item.checked ? "active" : ""})
            .click(function () {
              ipc.send('MenuItemActivated', engine.engineID,
                engine.menuitems[$(this).index()].id);
            }));
      });

    } else if (type == 'UiCandidateWindow') {
      debug("render", type);
      var ui = $('#imePanel #auxiliaryText');
      var _ = chrome.i18n.getMessage;
      // TODO(hungte) Remove the hard-coded prefix.
      // The auxiliaryText looks better if we always keep it.
      ui.text("|" + nbsp + engine.candidate_window.auxiliaryText + nbsp).
          prepend($('<span/>').css({color: '#444'}).
          text(_("imeToggleHint") + nbsp));

      if (false) {
        // The correct way (for debug)
        ui = $('#imePanel #candidates');
        if (!engine.candidate_window.visible) {
          ui.hide();
        } else {
          ui.show();
        }
      } else {
        // The special rendering way, for better visual feedback.
        ui = $('body');
        if (!engine.candidate_window.visible) {
          ui.css({opacity: 0.8});
          $('#imePanel #candidates').hide();
        } else {
          $('#imePanel #candidates').show();
          ui.css({opacity: 1.0});
        }
      }
    } else if (type == 'UiComposition') {
      debug("render", type);
      var ui = $('#imePanel #composition');
      ui.text((context ? context.composition.text : "" )+ nbsp);

    } else if (type == 'UiCandidates') {
      debug("render", type);
      var ui = $('#imePanel #candidates');
      ui.empty().append(nbsp);
      context.candidates.forEach(function (item) {
        var label = item.label || item.id;
        ui.append(
            $('<span/>', {text: item.candidate + ' ', "class": "candidate"}).
            prepend($('<span/>', {text: label, "class": "candidate_label"})));
      });
    }
  });
  ipc.send("UIReady");
});
