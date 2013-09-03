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
  ipc.recv(function (event_type, evt) {

    debug('<iframe> recv:', arguments);

    if (event_type != 'UIEvent') {
      debug('<iframe>', "NOT ime/UIEvent");
      return;
    }

    var type = evt.type;
    var context = evt.context;
    var engine = evt.engine;
    debug('<iframe>', type, context, engine);

    // http://stackoverflow.com/questions/8039182/matching-jquery-text-to-nbsp
    var nbsp = '\xa0';

    if (type == 'menu') {
      debug("render", type);
      var ui = $('#imePanel #menu');
      debug(ui);
      ui.empty();
      engine.menuitems.forEach(function (item) {
        debug("item", item);
        var label = item.label || item.id;
        ui.append(
            $('<li/>',  {text: label, 'class': item.checked ? "active" : ""})
            .click(function () {
              ipc.send('MenuItemActivated', engine.engineID,
                engine.menuitems[$(this).index()].id);
            }));
      });

    } else if (type == 'candidate_window') {
      debug("render", type);
      var ui = $('#imePanel #candidates');
      if (!engine.candidate_window.visible) {
        ui.hide();
      } else {
        ui.show();
      }

    } else if (type == 'composition') {
      debug("render", type);
      var ui = $('#imePanel #composition');
      ui.text((context ? context.composition.text : "" )+ nbsp);

    } else if (type == 'candidates') {
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
});
