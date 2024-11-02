# Chrome Input IME Emulation

The `chrome.input.ime` is currently only available on ChromeOS. However it is
possible to extend the Chrome extension so we can "emulate" the API on any web
pages using the "content script". This folder provides the implementation of
that.

## The IME interface
`chrome_input_ime.js` is the interface for `chrome.input.ime`. It is a bridge
between the input method environment in extension (`croscin.js`), and the
implementation that binds to the page.

## User interface
To render the composition and candidates (also the options to switch between
input methods), we created a several files for the user interfaces:

- `ime_panel.*`: The main user interface, a panel to show the composition and
  input text candidates (also auxiliary text).
- `menu.*`: The menu listing available input methods, also shortcut to the
  options page.

## Web page based implementation

The `webpage.js` is an implementation using the web page technology as the
backend.  Any web pages with a 'imePanel' DOM element with sub elements
'composition', 'candidates', 'auxilirary' can use this implementation.

This is currently directly used by the test pages like `/test/testarea.html`.

## IFRAME based implementation

The `iframe.js`, derived from `webpage.js`, is using web technology and can be
injected to other webpages with a iframe based UI. This can be used by the
Chrome extension content scripts.

The `iframe.js` is the core implementation. By default it will inject the iframe
using `ime_panel.html` as the UI. The IME itself is loaded in the main page
(e.g., where the INPUT lives) and it will only pass the UI commands to the
iframe using `window.postMessage` API.
