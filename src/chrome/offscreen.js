console.log("init offscreen.js");

chrome.runtime.onMessage.addListener(
  async function(request, sender, sendResponse) {
    console.log("handleMessages: ", request.action);
    if (request.target !== 'offscreen') {
      return;
    }

    switch (request.action) {
      case 'getMv2UserData':
        let pref = {};
        Object.keys(localStorage).forEach((k) => {
          let data = localStorage[k];
          pref[k] = data;
        });
        sendResponse({result: pref});
        return true;
        break;
      default:
        console.warn(`Unexpected message type received: '${request.type}'.`);
        return false;
    }

  });
