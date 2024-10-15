// Copyright 2013 Google Inc. All Rights Reserved.

/**
 * @fileoverview IME UI implementation for chrome.input.ime.
 * @author hungte@google.com (Hung-Te Lin)
 */

import { $, jQuery } from "../jquery/jquery-ui.js";
import { ImeExtensionIPC } from "./ipc.js";

import { AddLogger } from "../jscin/logger.js";
const {log, debug, info, warn, error, assert, trace} = AddLogger("emulation/ui");

$(function() {
  debug("ui.js started:", window.location.href);

  // http://stackoverflow.com/questions/8039182/matching-jquery-text-to-nbsp
  var nbsp = '\xa0';

  var ipc = new ImeExtensionIPC('iframe');
  ipc.attach();
  ipc.listen({
    UiMenu: function (engine) {
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
    },

    UiCandidateWindow: function (engine) {
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
          // We can only lower opacity if composition is also blank.
          // ui.css({opacity: 0.8});
          $('#imePanel #candidates').hide();
        } else {
          $('#imePanel #candidates').show();
          ui.css({opacity: 1.0});
        }
      }
    },

    UiComposition: function (context) {
      var ui = $('#imePanel #composition');
      var arg = context.composition;
      function get(key, def) {
        var val = arg[key];
        return (typeof(arg[key]) == typeof(undefined)) ? def : val;
      }
      debug("arg", arg);
      var text = get('text', '');
      var selectionStart = get('selectionStart', 0);
      var selectionEnd = get('selectionEnd', text.length);
      var cursor = get('cursor', text.length);
      var segments = get('segments', []);
      var i, len;
      var data = [];
      for (i = 0, len = text.length; i < len; i++) {
        data.push({text: text[i]});
      }
      data.push({text: nbsp});
      data[cursor].cursor = true;
      for (i = selectionStart; i < selectionEnd; i++) {
        data[i].selected = true;
      }
      for (i = 0; i < segments.length; i++) {
        for (var idx = segments[i].start; idx < segments[i].end; idx++) {
          data[idx].segment = (i + 1);
        }
      }
      ui.empty();
      var node = $('<span/>');
      var segi = undefined;
      for (i = 0, len = data.length; i < len; i++) {
        if (data[i].segment != segi) {
          // new segment.
          ui.append(node);
          segi = data[i].segment;
          node = $('<span/>');
          if (segi)
            node.attr('class', 'segment');
        }
        var newdata = document.createTextNode(data[i].text);
        if (data[i].cursor) {
          var cursor = $('<span class="cursor">');
          if (segi) {
            newdata = cursor.append(newdata);
          } else {
            node.append(cursor);
          }
        }
        node.append(newdata);
      }
      ui.append(node);
    },

    // TODO(hungte) Fire CandidateClicked event.
    UiCandidates: function (context) {
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
  ipc.send("IpcUiReady");
});
