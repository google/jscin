This folder contains source to JavaScript Chinese Input Method.

Configuration:
  - jscin/jscin.js: Top level definition of constants, configuration, utilities...

Modules:
  - jscin/gen_inp.js: General input method module.

Tables:
  - tables/builtin.json: List of built-in tables.
  - tables/*.cin: Built-in tables.

Platform bindings:
  ChromeOS: (chrome/)
    - manifest.json: ChromeOS extension manifest file.
    - croscin.html: ChromeOS extension main background page.
    - croscin.js: Source for ChromeOS extension bindings.
    - options/ Options page for ChromeOS extension
    To test and debug online (on a Chromebook), do
      cd /home/chronos/user/Download; mkdir croscin;
      sshfs -o allow_other -o follow_symlinks \
        user@host:PATH_TO_JSCIN/src/chrome /home/chronos/user/Download/croscin
      Then enter chrome://extentions, Load unpacked extensions, and select
        croscin in Downloads folder.
    To package and upload into webstore, do
      cd PATH_TO_JSCIN/src; zip -r9 chrome.zip chrome;
      Then upload the chrome.zip to webstore.

  Console (for d8 from V8 / jsshell from SpiderMonkey, console/):
    - console.js: run "d8 console.js" for testing without UI.

Documents (../docs):
  - inpinfo.txt: Document for the interface from original XCIN to JS/CIN.
