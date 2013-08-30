/**
 * @fileoverview Description of this file.
 */

// Testing functions
testContextID = '1';

function debug() {
  console.log.apply(console, arguments);
}

function test_setCandidateWindowProperties(flag) {
  chrome.input.ime.setCandidateWindowProperties({
    contextID: testContextID,
    properties: {visible: flag}});
}

function test_clearComposition() {
  chrome.input.ime.clearComposition({
    contextID: testContextID});
}

function test_setComposition(text) {
  chrome.input.ime.setComposition({
    contextID: testContextID,
    text: text});
}

function test_commitText(text) {
  chrome.input.ime.commitText({
    contextID: testContextID,
    text: text});
}

function test_setCandidates(candidate_string) {
  var i;
  var items = [];

  for (i in candidate_string) {
    items.push({
      candidate: candidate_string[i],
      id: parseInt(i),
      label: "" + (parseInt(i) + 1)});
  }
  chrome.input.ime.setCandidates({
    contextID: testContextID,
    candidates: items});
}

// jquery-based test init
function test_setMenuItems(labels_array) {
  var i;
  var items = [];
  labels_array.forEach(function(label) {
    items.push({
      id: 'id_' + label,
      label: label,
      style: 'radio',
    });
  });
  chrome.input.ime.setMenuItems({
    engineID: chrome.input.ime.engineID,
    items: items});
}

$(function() {
  chrome.input = { ime: new ChromeInputIME };

  // Setup UI rendering
  chrome.input.ime.setUserInterfaceHandlers({
    menu:
    function(engine) {
      // Update IME UI
      var ui = $('#imePanel #menu');
      ui.empty();
      engine.menuitems.forEach(function (item) {
        var label = item.label || item.id;
        ui.append(
            $('<li/>', {text: label}).click(function () {
              chrome.input.ime.dispatchEvent(
                  'MenuItemActivated', engine.engineID,
                  engine.menuitems[$(this).index()].id);
            }));
      });
    },

    candidates_window:
    function(engine) {
      // candidates window
      var ui = $('#imePanel #candidates');
      if (!engine.candidate_window.visible) {
        ui.hide();
      }
      ui.show();
    },

    composition:
    function(context) {
      // composition area
      var ui = $('#imePanel #composition');
      // http://stackoverflow.com/questions/8039182/matching-jquery-text-to-nbsp
      var nbsp = '\xa0';
      ui.text((context ? context.composition.text : "" )+ nbsp);
    },

    candidates:
    function (context) {
      var ui = $('#imePanel #candidates');
      var nbsp = '\xa0';
      ui.empty().append(nbsp);
      context.candidates.forEach(function (item) {
        var label = item.label || item.id;
        ui.append(
            $('<span/>', {text: item.candidate + ' ', "class": "candidate"}).
            click(function () {
              chrome.input.ime.dispatchEvent('CandidateClicked',
                "", item.id, 'left'); }).
          prepend($('<span/>', {text: label, "class": "candidate_label"})));
      });
    }
  });

  var node = document.getElementById('input');
  node.blur();
  chrome.input.ime.attach(node);

  if (chrome && chrome.extension) {
    var croscin = chrome.extension.getBackgroundPage().croscin.instance;
    jscin = chrome.extension.getBackgroundPage().jscin;

    // Get all logs on my console.
    jscin.add_logger(console.log, console);
    croscin.set_ime_api(chrome.input.ime, 'emulation');
    croscin.registerEventHandlers();
    // croscin has already started, so we need to activate again.
    chrome.input.ime.dispatchEvent('Activate', 'input_ime');
    $('#TestItems').hide();
  } else {
    // Running in simple web page, let's enable all testing buttons.
    $('#TestItems button').attr("onClick",
        function () { return "test_" + $(this).text(); });
    chrome.input.ime.onKeyEvent.addListener(function(engineID, ev) {
      var val = $('#chkKeyEvent').prop('checked');
      debug("onKeyEvent(" + engineID + "): " + ev);
      return !val;
    });
    chrome.input.ime.onBlur.addListener(function(contextID) {
      debug("onBlur(" + contextID + ")");
    });
    chrome.input.ime.onFocus.addListener(function(context) {
      debug(context);
      debug("onFocus({" + context.contextID + ", " + context.type + "})");
    });
    chrome.input.ime.onMenuItemActivated.addListener(function(engineID, menu_id) {
      debug("menu item activated: id=" + menu_id);
    });
  }

  node.focus();
});
