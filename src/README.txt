This folder contains source to JavaScript Chinese Input Method.

Configuration:
  - jscin.js: Top level definition of constants, configuration, utilities...

Modules:
  - gen_inp.js: General input method module.

Tables:
  - hardcode.js: A temporary hacked table.

Platform bindings:
  ChromeOS:
    - manifest.json: ChromeOS extension manifest file.
    - croscin.html: ChromeOS extension main background page.
    - croscin.js: Source for ChromeOS extension bindings.
    - options/ Options page for ChromeOS extension

  Console (for d8 from V8 / jsshell from SpiderMonkey):
    - console.js: run "d8 console.js" for testing without UI.

Documents:
  - ../inpinfo.txt: Document for the interface from original XCIN to JS/CIN.
