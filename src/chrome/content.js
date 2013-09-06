// Copyright 2013 Google Inc. All Rights Reserved.

/**
 * @fileoverview JSCIN for Chrome Extension, content injection.
 * @author hungte@google.com (Hung-Te Lin)
 */

// TODO(hungte) Get fully serialized jscin, or totally do jscin in content side.
// TODO(hungte) Support dynamic DOM nodes better.
// TODO(hungte) Load jquery on demand.

function CreateImeFrame () {
  var frame = document.createElement("iframe");
  var frameURL = chrome.extension.getURL('input_api/ime.html');
  frame.setAttribute("src", frameURL);
  frame.setAttribute("scrolling", "no");
  frame.setAttribute("frameBorder", 0);
  frame.setAttribute("allowTransparency", true);
  frame.style.zIndex = 999999;
  frame.style.border = 0;
  frame.style.padding = 0;
  frame.style.width = "30em";
  frame.style.height = "10em";
  frame.style.position = "absolute";
  frame.style.backgroundColor = "transparent";
  frame.style.display = "none";
  document.getElementsByTagName('body')[0].appendChild(frame);
  return frame;
}

function init () {
  // Check chrome.input.ime availability.  The correct way is to check
  // chrome.input.ime binding but that would spew error message in console for
  // every page; so let's check userAgent instead because for right now only
  // ChromeOS supports that.
  if (window.navigator.userAgent.indexOf(' CrOS ') >= 0)
    return;

  // Check if we have any input DOM elements to attach IME.

  var i;
  var nodes;
  var targets = [];

  nodes = document.getElementsByTagName('input');
  for (i = 0; i < nodes.length; i++) {
    var type = nodes[i].type;
    if (type) {
      type = type.toLowerCase();
      if (type != "" && type != "text" && type != "search")
        continue;
    }
    targets.push(nodes[i]);
  }

  nodes = document.getElementsByTagName('textarea');
  for (i = 0; i < nodes.length; i++) {
    targets.push(nodes[i]);
  }

  $('[contenteditable]').each(function (i) {
    var node = this;
    if (targets.indexOf(node) < 0)
      targets.push(node);
  });

  if (!targets.length)
    return;

  var impl = new ChromeInputImeImplChromeExtension('content');
  impl.debug("Installing extension IME, input elements:", targets.length);
  impl.init();
  impl.setFrame($(CreateImeFrame()));

  var focused = document.activeElement;
  targets.forEach(function (node) {
    impl.attach(node);
    if (focused == node) {
      impl.debug("detected init node");
      impl.setInitNode(node);
    }
  });

  // Also attach to dynamic nodes. Currently only works for gmail composition.
  document.addEventListener("DOMNodeInserted", function (ev) {
    var node = ev.relatedNode;
    if (node.tagName.toLowerCase() == 'input' ||
        node.tagName.toLowerCase() == 'textarea' ||
        node.getAttribute('contenteditable')) {
      impl.debug("got new input node", ev);
      impl.attach(node);
    }
  }, true);

}

// For content.js we can't wait for readystatechange - that is controlled by
// manifest:run_at.
init();
