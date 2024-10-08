// Copyright 2013 Google Inc. All Rights Reserved.

/**
 * @fileoverview JSCIN for Chrome Extension, content injection.
 * @author hungte@google.com (Hung-Te Lin)
 */

function CreateImeFrame () {
  var frame = document.createElement("iframe");
  var frameURL = chrome.runtime.getURL('input_api/ime.html');
  frame.setAttribute("src", frameURL);
  frame.setAttribute("scrolling", "no");
  frame.setAttribute("frameBorder", 0);
  frame.setAttribute("allowTransparency", true);
  frame.style.zIndex = 999999;
  frame.style.border = 0;
  frame.style.padding = 0;
  frame.style.width = "32em";
  frame.style.height = "11em";
  frame.style.position = "absolute";
  frame.style.backgroundColor = "transparent";
  frame.style.display = "none";
  var ref = document.getElementsByTagName('body')[0] || document.children[0];
  ref.appendChild(frame);
  return frame;
}

async function init () {
  // Check chrome.input.ime availability.  The correct way is to check
  // chrome.input.ime binding but that would spew error message in console for
  // every page; so let's check userAgent instead because for right now only
  // ChromeOS supports that.
  if (window.navigator.userAgent.indexOf(' CrOS ') >= 0)
    return;

  const src = chrome.runtime.getURL("input_api/impl_chromeext.js");
  const mod = await import(src);
  var impl = new mod.ChromeInputImeImplChromeExtension('content');
  impl.debug("Extension IME installed.");
  impl.init(CreateImeFrame);
  return impl;
}

var impl = init();
