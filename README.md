# JsCIN: JavaScript based Common Input Method Editor (IME)

For how to install or run JsCIN, please check the [user guide
document](docs/USER_GUIDE.md).

關於如何安裝與使用，請參考[使用說明文件](docs/USER_GUIDE.md).

## Introduction

Porting the input method editors (IME) to everywhere is painful, especially
when you failed to find your favorite input method on a new tablet or phone
devices. It would be great if we can have the input methods as web browser
extensions since it will be easy to sync and use your favorite input methods
whenever needed. Moreover, some OSes like Google ChromeOS does not allow
installing the native programs by the user themselves.

Chrome browser now supports an [extension API
](http://dev.chromium.org/developers/design-documents/extensions/input-method-editor),
Although it's only available for ChromeOS.

This project is a JavaScript implementation of input methods editor to
support customizable table based input methods. It is
compatible with CIN format tables from [XCIN](https://zh.wikipedia.org/zh-tw/Xcin)
2.5 to serve ChromeOS and other platforms allowing IMEs implemented in JavaScript.
