var inited = false;
console.log("ServiceWorker: enter, inited=", inited);

importScripts('jscin/lz-string.js','jscin/jscin.js' ,'jscin/base_inp.js' ,'jscin/gen_inp.js' ,'jscin/gen_inp2.js' ,'jscin/cin_parser.js' ,'jscin/base_addon.js' ,'jscin/addon_related.js' ,'jscin/addon_punctuations.js' ,'input_api/ipc.js' ,'input_api/ime_event.js' ,'input_api/impl_chromeext.js' ,'input_api/chrome_input_ime.js' ,'croscin.js');
//'oauth/chrome_ex_oauthsimple.js' ,'oauth/chrome_ex_oauth.js' ,'oauth/oauth.js');


function initJscinCompleted() {
    console.log("initJscinCompleted");
    croscin.instance = new croscin.IME;
}

function initCroscinCompleted() {
    console.log("initCroscinCompleted");
    inited = true;
    console.log("ServiceWorker: inited=", inited);
}

chrome.runtime.onMessage.addListener(
  function(request, sender, sendResponse) {
    console.log("ServiceWorker: action=", request.action);

    switch (request.action) {
        case "getServiceWorkerData":
            if (inited) {
                sendResponse({pref: croscin.instance.pref, metadatas: jscin.getTableMetadatas()});
            }
            else {
                sendResponse({error: true});
            }
            return true;
            break;
        case "installInputMethod":
            let result = jscin.install_input_method(request.name, request.table_source, request.metadata);
            sendResponse({result: result});
            return true;
            break;
        case "setEnabledList":
            let new_list = request.data;
            croscin.instance.prefSetEnabledList(new_list);
            break;
        case "notifyConfigChanged":
            croscin.instance.notifyConfigChanged();
            croscin.instance.ActivateInputMethod(croscin.instance.pref.im_default);
            break;
        case "prefSetSupportNonChromeOS":
            croscin.instance.prefSetSupportNonChromeOS(request.checked);
            break;
        case "prefSetDefaultEnabled":
            croscin.instance.prefSetDefaultEnabled(request.checked);
            break;
        case "prefSetQuickPunctuations":
            croscin.instance.prefSetQuickPunctuations(request.checked);
            break;
        case "prefSetRelatedText":
            croscin.instance.prefSetRelatedText(request.checked);
            break;
        case "setDebugMode":
            croscin.instance.setDebugMode(request.checked);
            break;
        case "resetPreference":
            croscin.instance.resetPreference();
            break;
    }
  }
);
