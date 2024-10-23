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
  let nbsp = '\xa0';

  let ipc = new ImeExtensionIPC('iframe');
  ipc.attach();
  ipc.listen({
    UiMenu: function (engine) {
      let ui = $('#imePanel #menu');
      if (!ui)
        return;
      debug(ui);
      ui.empty();
      for (let item of engine.menuitems) {
        debug("item", item);
        let label = item.label || item.id;
        ui.append(
            $('<div/>',  {text: label, 'class': item.checked ? "active" : ""})
            .click(function () {
              ipc.send('MenuItemActivated', engine.engineID,
                engine.menuitems[$(this).index()].id);
            }));
      }
    },

    UiCandidateWindow: function (engine) {
      let ui = $('#imePanel #auxiliaryText');
      let _ = chrome.i18n.getMessage;
      // TODO(hungte) Remove the hard-coded prefix.
      // The auxiliaryText looks better if we always keep it.
      ui.text(`|${nbps}${engine.candidate_window.auxiliaryText}${nbsp}`).
          prepend($('<span/>').css({color: '#444'}).
          text(`${_("imeToggleHint")}${nbsp}`));

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
      let ui = $('#imePanel #composition');
      let arg = context.composition;
      function get(key, def) {
        let val = arg[key];
        return (typeof(arg[key]) == typeof(undefined)) ? def : val;
      }
      debug("arg", arg);
      let text = get('text', '');
      let selectionStart = get('selectionStart', 0);
      let selectionEnd = get('selectionEnd', text.length);
      let cursor = get('cursor', text.length);
      let segments = get('segments', []);
      let data = text.split('').map((c) => ({text: c}));
      data.push({text: nbsp});
      data[cursor].cursor = true;
      for (let i = selectionStart; i < selectionEnd; i++) {
        data[i].selected = true;
      }
      for (let i in segments) {
        for (let idx = segments[i].start; idx < segments[i].end; idx++) {
          data[idx].segment = (i + 1);
        }
      }
      ui.empty();
      let node = $('<span/>');
      let segi = undefined;
      for (let d of data) {
        if (d.segment != segi) {
          // new segment.
          ui.append(node);
          segi = d.segment;
          node = $('<span/>');
          if (segi)
            node.attr('class', 'segment');
        }
        let newdata = document.createTextNode(d.text);
        if (d.cursor) {
          let cursor = $('<span class="cursor">');
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
      let ui = $('#imePanel #candidates');
      ui.empty().append(nbsp);
      for (let item of context.candidates) {
        let label = item.label || item.id;
        ui.append(
            $('<span/>', {text: item.candidate + ' ', "class": "candidate"}).
            prepend($('<span/>', {text: label, "class": "candidate_label"})));
      }
    }
  });
  ipc.send("IpcUiReady");
});
