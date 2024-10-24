# JsCIN Source Code
This folder contains source to JavaScript Chinese Input Method.

## Core Modules
- `jscin/jscin.js`: Top level definition of constants, configuration,
  utilities...
- `jscin/gen_inp.js`: General input method module, translated from xcin.
- `jscin/gen_inp2.js`: General input method module v2, written from scratch.
  This is currently the default module.

## Tables
- `tables/builtin.json`: List of built-in tables.
- `tables/*.cin`: Built-in tables.
- `tables/tsi.json`: Database for phrases.
- `tables/types.json`: The known types of input methods.

## Documents
- `docs/cin.txt`: Document for the `*.cin` file format.
- `docs/inpinfo.txt`: Document for the interface from original XCIN to
  JS/CIN.

### Tests
You can find some test files in `tests/`. May be executed by Node.js
interpreter (`node`).

## Platform bindings:

### Chrome based platforms (ChromeOS and Chrome browser)
- `chrome/manifest.json: Chrome extension manifest file.
- `chrome/croscin.js`: The extension based IME core implementation.
- `chrome/options/`: The option page of the Chrome extension.

To test and debug online (on a Chromebook), do:
````
  cd /home/chronos/user/Download; mkdir croscin;
  sshfs -o allow_other -o follow_symlinks \
    user@host:PATH_TO_JSCIN/src/chrome /home/chronos/user/Download/croscin
````
Then enter `chrome://extentions`, Load unpacked extensions, and select
`croscin` in the `Downloads` folder.

To package and upload into the Chrome Web Store., do:
````
  cd PATH_TO_JSCIN/src; zip -r9 chrome.zip chrome;
````
Then upload the chrome.zip to the Chrome Web Store..

### Console (for Node.js)
 - `console/console.js`: run `node console.js` for testing without UI.

Previously we support v8/d8 and Seamonkey jsshell, but for 2024+ Node seems to
be the best and easily available option.
