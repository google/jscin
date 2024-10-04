JavaScript based Chinese Input Method

Porting input method environment (IME) everywhere is painful, especially when
you failed to find your favorite IME on new tablet / phone devices. It would be
great if we can have IME as web browser extension since it'll be easy to sync
your favorite input method everywhere. Moreoever, some OS like Google ChromeOS
does not allow installing userland native programs.

Chrome browser now supports an "extension API":
http://dev.chromium.org/developers/design-documents/extensions/input-method-editor
Although it's now only avaialable for ChromeOS.

This project is a JavaScript implementation of Chinese Input Method that is
compatible with XCIN 2.5 to serve ChromeOS and other platforms allowing IMEs
implemented in JavaScript.
