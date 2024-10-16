# Chrome Input IME Emulation

The `chrome.input.ime` is currently only available on ChromeOS. However it is
possible to extend the Chrome extension so we can "emulate" the API on any web
pages using the "content script". This folder provides the implementation of
that.

## The IME interface
`chrome_input_ime.js` is the interface for `chrome.input.ime`. It is a bridge
between the input method environment in extension (`croscin.js`), and the
implementation that binds to the page. It provides a few extra callbacks:
`onUi*` and `onImpl*`, that the underlying emulation layer should listen to the
event and respond to it for UI changes or actions.

## User interface
To render the composition and candidates (also the options to switch between
input methods), we created a several files for the user interfaces:

- `ui.*`: The main user interface, a frame to show the composition and
  input text candidates.
- `menu.*`: The menu listing available input methods, also shortcut to the
  options page.

## IPC based implementation
The `ipc*.js` provides an implementation using [Chrome Extension Message
passing](https://developer.chrome.com/docs/extensions/develop/concepts/messaging).

The advantage is there is only one instance for key processing, very similar to
the real architecture under ChromeOS. The content script can be minimal - it does
not need to have the whole data mapping table, only listening and forwarding
key events.

However, there are a few cons:
- Extra latency every key press need to be sent to the extension background and
  wait for the returned value.
- We have to decide early if the `KeyboardEvent` should be canceled or not
  before the IPC is done. As a result, a new complicated (and sometimes buggy)
  `accepted_keys` concept is introduced to the input methods and really hard to
  maintain.

And for the files:
- `ipc.js`: provides the base library as wrapper for `chrome.runtime.sendMessage`.
- `ipc_background.js`: is what the background script should run.
- `ipc_content.js`: is what the content script should run.

## Page based implementation

This is currently only available for a page explicitly loading the IME
emulation modules, for example the `testarea.html` test page inside the
extension itself.

In the future we should extend it as another option without IPC.

- `impl_page.js`: page based implementation.
