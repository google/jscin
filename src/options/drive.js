function SaveToDrive(ename, content) {
  var handleSuccess = function(resp, xhr) {
    var link = getLink(JSON.parse(resp).entry.link, 'alternate').href;
    var link = getLink(JSON.parse(resp).entry.link, 'http://schemas.google.com/docs/2007#embed').href;
    $("#drive_" + ename).html($('<a>', { href: link, target: '_blank' }).html('Backup on Google Drive'));
    metadata = jscin.getTableMetadatas();
    metadata[ename].link = link;
    jscin.writeLocalStorage(jscin.kTableMetadataKey, metadata);
  };
  var params = {
    'method': 'POST',
    'headers': {
      'GData-Version': '3.0',
      'Content-Type': 'multipart/related; boundary=END_OF_PART',
    },
    'parameters': {'alt': 'json'},
    'body': constructContentBody_(ename + '.cin', 'document', content, 'text/plain')
  };
  $("#drive_" + ename).html('Uploading to Google Drive...');
  bgPage.oauth.sendSignedRequest(bgPage.DOCLIST_FEED, handleSuccess, params);
}

function getLink(links, rel) {
  for (var i = 0, link; link = links[i]; ++i) {
    if (link.rel === rel) {
      return link;
    }
  }
  return null;
};

function constructAtomXml_(docTitle, docType, opt_starred) {
  var starred = opt_starred || null;

  var starCat = ['<category scheme="http://schemas.google.com/g/2005/labels" ',
                 'term="http://schemas.google.com/g/2005/labels#starred" ',
                 'label="starred"/>'].join('');

  var atom = ["<?xml version='1.0' encoding='UTF-8'?>", 
              '<entry xmlns="http://www.w3.org/2005/Atom">',
              '<category scheme="http://schemas.google.com/g/2005#kind"', 
              ' term="http://schemas.google.com/docs/2007#' + docType + '"/>',
              starred ? starCat : '',
              '<title>', docTitle, '</title>',
              '</entry>'].join('');
  return atom;
};

function constructContentBody_(title, docType, body, contentType, opt_starred) {
  return ['--END_OF_PART\r\n',
          'Content-Type: application/atom+xml;\r\n\r\n',
          constructAtomXml_(title, docType, opt_starred), '\r\n',
          '--END_OF_PART\r\n',
          'Content-Type: ', contentType, '\r\n\r\n',
          body, '\r\n',
          '--END_OF_PART--\r\n'].join('');
};

function getCategory(categories, scheme, opt_term) {
  for (var i = 0, cat; cat = categories[i]; ++i) {
    if (opt_term) {
      if (cat.scheme === scheme && opt_term === cat.term) {
        return cat;
      }
    } else if (cat.scheme === scheme) {
      return cat;
    }
  }
  return null;
};

function GoogleDoc(entry) {
  this.entry = entry;
  this.title = entry.title.$t;
  this.resourceId = entry.gd$resourceId.$t;
  this.type = getCategory(
    entry.category, 'http://schemas.google.com/g/2005#kind');
  this.link = {
    'alternate': getLink(entry.link, 'alternate').href
  };
  // this.contentSrc = entry.content.src;
};

function renderDocList(entry) {
  var list = $('#doc_list');
  list.html('');
  for (var i = 0, doc; doc = bgPage.docs[i]; ++i) {
    list.append('<input type="radio" name="google_doc" id="radio' + i + '">');
    list.append($('<label>', { 'for': 'radio' + i }).html(doc.title));
    list.append($('<br>'));
  }
  $('#doc_list').show();
}

function processDocListResults(response, xhr) {
  if (xhr.status != 200) {
    return;
  }

  var data = JSON.parse(response);

  for (var i = 0, entry; entry = data.feed.entry[i]; ++i) {
    var doc = new GoogleDoc(entry);
    if(doc.type.label == 'document') {
      bgPage.docs.push(doc);
    }
  }

  var nextLink = getLink(data.feed.link, 'next');
  if (nextLink) {
    getDocumentList(nextLink.href); // Fetch next page of results.
  } else {
    renderDocList();
  }
};

function unstringify(paramStr) {
  var parts = paramStr.split('&');

  var params = {};
  for (var i = 0, pair; pair = parts[i]; ++i) {
    var param = pair.split('=');
    params[decodeURIComponent(param[0])] = decodeURIComponent(param[1]);
  }
  return params;
};

function getDocumentList(opt_url) {
  var url = opt_url || null;

  var params = {
    'headers': {
      'GData-Version': '3.0'
    }
  };

  if (!url) {
    bgPage.docs = []; // Clear document list. We're doing a refresh.

    url = bgPage.DOCLIST_FEED;
    params['parameters'] = {
      'alt': 'json',
      'showfolders': 'false'
    };
  } else {
    var parts = url.split('?');
    if (parts.length > 1) {
      url = parts[0]; // Extract base URI. Params are passed in separately.
      params['parameters'] = unstringify(parts[1]);
    }
  }

  bgPage.oauth.sendSignedRequest(url, processDocListResults, params);
};