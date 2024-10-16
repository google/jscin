# JavaScript based Chinese Input Method

For how to install or run JsCIN, please check the [user guide
document](docs/USER_GUIDE.md).

關於如何安裝與使用，請參考[使用說明文件](docs/USER_GUIDE.md).

## Introduction

Porting the input method environment (IME) to everywhere is painful, especially
when you failed to find your favorite input method on a new tablet or phone
devices. It would be great if we can have the input methods as web browser
extensions since it will be easy to sync and use your favorite input methods
whenever needed. Moreover, some OSes like Google ChromeOS does not allow
installing the native programs by the user themselves.

Chrome browser now supports an [extension API
](http://dev.chromium.org/developers/design-documents/extensions/input-method-editor),
Although it's only available for ChromeOS.

This project is a JavaScript implementation of Chinese Input Method that is
compatible with XCIN 2.5 to serve ChromeOS and other platforms allowing IMEs
implemented in JavaScript.
