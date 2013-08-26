var DOCLIST_SCOPE = 'https://docs.google.com/feeds';
var DOCLIST_FEED = DOCLIST_SCOPE + '/default/private/full/';
var docs = []; // In memory cache for the user's entire doclist.
var folderDocs = [];
var refreshRate = localStorage.refreshRate || 300; // 5 min default.
var pollIntervalMin = 1000 * refreshRate;
var requests = [];
var oauth = ChromeExOAuth.initBackgroundPage({
  'request_url': 'https://www.google.com/accounts/OAuthGetRequestToken',
  'authorize_url': 'https://www.google.com/accounts/OAuthAuthorizeToken',
  'access_url': 'https://www.google.com/accounts/OAuthGetAccessToken',
  'consumer_key': 'anonymous',
  'consumer_secret': 'anonymous',
  'scope': DOCLIST_SCOPE,
  'app_name': 'CrosCIN IME Extension'
});
function setIcon(opt_badgeObj) {
  if (opt_badgeObj) {
    var badgeOpts = {};
    if (opt_badgeObj && opt_badgeObj.text != undefined) {
      badgeOpts['text'] = opt_badgeObj.text;
    }
    if (opt_badgeObj && opt_badgeObj.tabId) {
      badgeOpts['tabId'] = opt_badgeObj.tabId;
    }
    chrome.browserAction.setBadgeText(badgeOpts);
  }
};
function clearPendingRequests() {
  for (var i = 0, req; req = requests[i]; ++i) {
    window.clearTimeout(req);
  }
  requests = [];
};
function logout() {
  docs = [];
  setIcon({'text': ''});
  oauth.clearTokens();
  clearPendingRequests();
};
