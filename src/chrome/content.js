// Copyright 2013 Google Inc. All Rights Reserved.

/**
 * @fileoverview JSCIN for Chrome Extension, content injection.
 * @author hungte@google.com (Hung-Te Lin)
 */

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
  var ref = document.getElementsByTagName('body')[0] || document.children[0];
  ref.appendChild(frame);
  return frame;
}

function init () {
  // Check chrome.input.ime availability.  The correct way is to check
  // chrome.input.ime binding but that would spew error message in console for
  // every page; so let's check userAgent instead because for right now only
  // ChromeOS supports that.
  if (window.navigator.userAgent.indexOf(' CrOS ') >= 0)
    return;

  // TODO(hungte) Find way to get croscin.instance.prefGetSupportNonChromeOS().
  var impl = new ChromeInputImeImplChromeExtension('content');
  impl.debug("Extension IME installed.");
  impl.init();
  if (window.self === window.top)
    impl.setFrame($(CreateImeFrame()));
}

// For content.js we can't wait for readystatechange - that is controlled by
// manifest:run_at.
init();
