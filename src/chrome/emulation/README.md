# Chrome Input IME Emulation

The `chrome.input.ime` is currently only available on ChromeOS. However it is
possible to extend the Chrome extension so we can "emulate" the API on any web
pages using the "content script". This folder provides the implementation of
that.

## The IME interface
`chrome_input_ime.js` is the interface for `chrome.input.ime`. It is a bridge
between the input method environment in extension (`croscin.js`), and the
implementation that binds to the page.

## Web page based implementation

The `webpage.js` is an implementation using the web page technology as the
backend.  Any web pages with a 'imePanel' DOM element with sub elements
'composition', 'candidates', 'auxilirary' can use this implementation.

This is currently directly used by the test pages like `/test/testarea.html`.

## IFRAME based implementation

The `iframe` folder contains multiple files for emulating the IME interfaces
by injecting a `<IFRAME>` HTML tag to existing pages. This is used by Chrome
extension content script to provide a full UI experience.

The `content.js` is the core implementation runs in the content script context.
By default it will inject the iframe using `ime_panel.html` as the UI. The IME
itself is loaded in the main page (e.g., where the INPUT lives) and it will
only pass the UI commands to the iframe using `window.postMessage` API.

The `ime_panel.{html,js,css}` can render the composition, candidates, auxiliary
text, even the options to switch between input methods (menu). For commands
like MenuItemActivated or CandidateClicked, it has to forward the event back to
`content.js` context using `chrome.runtime.sendMessage`.
