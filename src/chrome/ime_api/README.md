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
'composition', 'candidates', 'auxiliary' can use this implementation.

This is currently directly used by the test pages like `/test/testarea.html`.

## Inter process communication components based implementation

The `ipc` folder contains multiple files for fully emulating the
`chrome.input.ime` experience in any pages inside a browser, using the Chrome
extension technology via inter process communication (IPC).

- `ipc_content.js`: The core input method module runs in the content script
  context, based on web page implementation. Will bind input events to the
  `<INPUT>` and `<TEXTAREA>` HTML tags.
- `ime_panel.{html,js,css}`: The user interface, that will be injected into the
  web page inside a `<IFRAME>` HTML tag. The `ime_panel` will render the
  composition, candidates, auxiliary text.
- `menu.{html,js}`: The quick list of enabled input methods to choose from,
  a replacement for the system input methods menu on ChromeOS.
