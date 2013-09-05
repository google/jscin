var DRIVE_FOLDER = 'CrosCIN';

function uploadDocument(ename, content, folderId) {
  var handleSuccess = function(resp, xhr) {
    var entry = JSON.parse(resp).entry;
    var link = getLink(entry.link, 'http://schemas.google.com/docs/2007#embed').href;
    $("#drive_" + ename).empty().append(
      $('<a>', { href: link, target: '_blank' }).text('Backup on Google Drive'));
    metadata = jscin.getTableMetadatas();
    metadata[ename].link = link;
    metadata[ename].url = entry.content.src + '&format=txt';
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
  $("#drive_" + ename).text('Uploading to Google Drive...');
  bgPage.oauth.sendSignedRequest(bgPage.DOCLIST_FEED + folderId + '/contents', handleSuccess, params);
}

function createFolderUpload(ename, content) {
  var handleSuccess = function(resp, xhr) {
    uploadDocument(ename, content);
  };
  var params = {
    'method': 'POST',
    'headers': {
      'GData-Version': '3.0',
      'Content-Type': 'application/atom+xml',
    },
    'parameters': {'alt': 'json'},
    'body': [
              "<?xml version='1.0' encoding='UTF-8'?>",
              '<entry xmlns="http://www.w3.org/2005/Atom">',
              '<category scheme="http://schemas.google.com/g/2005#kind"',
              ' term="http://schemas.google.com/docs/2007#folder"/>',
              '<title>', DRIVE_FOLDER, '</title>',
              '</entry>',
             ].join('')
  };
  bgPage.oauth.sendSignedRequest(bgPage.DOCLIST_FEED, handleSuccess, params);
}

function SaveToDrive(ename, content) {
  // Get the folder if it exist
  var params = {
    'headers': {
      'GData-Version': '3.0'
    },
    'parameters': {
      'title': DRIVE_FOLDER,
      'title-exact': true,
      'alt': 'json',
      'showfolders': 'true'
    }
  };

  var handleFolderFeed = function(resp, xhr) {
    var feed = JSON.parse(resp).feed;
    if (feed.entry === undefined) { // if the folder doesn't exist
      createFolderUpload(ename, content);
    }
    else {
      uploadDocument(ename, content, feed.entry[0].gd$resourceId.$t);
    }
  }

  bgPage.oauth.sendSignedRequest(bgPage.DOCLIST_FEED, handleFolderFeed, params);
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
  var atom = ["<?xml version='1.0' encoding='UTF-8'?>",
              '<entry xmlns="http://www.w3.org/2005/Atom">',
              '<category scheme="http://schemas.google.com/g/2005#kind"',
              ' term="http://schemas.google.com/docs/2007#' + docType + '"/>',
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

function setDocStatus(status) {
  $('#doc_status').text(status);
}

function findPreviousBackupFolder() {
  for (var i = 0, doc; doc = bgPage.docs[i]; ++i) {
    if (doc.type.label == 'folder' && doc.title == DRIVE_FOLDER)
      return doc.resourceId;
  }
  return '';
}

function renderDocList(docs) {
  var list = $('#doc_list');
  list.empty();
  $.each(docs, function(i, doc) {
    if (doc.type.label == 'document') {
      list.append($('<input>', {
                      type:     'radio',
                      name:     'google_doc',
                      id:       'radio' + i,
                      checked : (i == 0)
                    }));
      list.append($('<label>', { 'for': 'radio' + i }).text(doc.title));
      list.append($('<br>'));
    }
  });
  $("#add_table_dialog").dialog('option', 'buttons', [
    {
      text: "OK",
      click: function() {
        $(this).dialog("close");
        addTableDrive(docs);
      }
    },
    {
      text: _("optionCancel"),
      click: function() {
        $(this).dialog("close");
      }
    }
  ]).dialog('open');

}

function appendAllDocsLink(message) {
  var a = $('<a>', { "id":"list_all", "href":"" }).text(message);
  $("#doc_status").append($('<br>'), a);
  $("#list_all").click(function(event) {
    setDocStatus("All documents:");
    renderDocList(bgPage.docs);
    event.preventDefault();
  });
}

function unstringify(paramStr) {
  var parts = paramStr.split('&');

  var params = {};
  for (var i = 0, pair; pair = parts[i]; ++i) {
    var param = pair.split('=');
    params[decodeURIComponent(param[0])] = decodeURIComponent(param[1]);
  }
  return params;
};

function getDocumentList(folderId, url) {
  var params = {
    'headers': {
      'GData-Version': '3.0'
    }
  };

  if (!url) {
    url = bgPage.DOCLIST_FEED;
    if (folderId) {
      url += folderId + '/contents';
      bgPage.folderDocs = []; // Clear document list. We're doing a refresh.
    } else {
      bgPage.docs = [];
    }

    params['parameters'] = {
      'alt': 'json',
      'showfolders': 'true'
    };
  } else {
    var parts = url.split('?');
    if (parts.length > 1) {
      url = parts[0]; // Extract base URI. Params are passed in separately.
      params['parameters'] = unstringify(parts[1]);
    }
  }

  var processDocListResults = function(response, xhr) {
    if (xhr.status != 200) {
      return;
    }

    var data = JSON.parse(response);

    if (data.feed.entry === undefined) {
      if(folderId) { // Croscin folder is found, but it's empty
        appendAllDocsLink("It is empty. List all my document.");
        renderDocList([]);
      } else { // The whole drive is empty
        alert('Cannot find any documents in your Google Drive.');
      }
      return;
    }

    for (var i = 0, entry; entry = data.feed.entry[i]; ++i) {
      var doc = new GoogleDoc(entry);
      if (folderId)
        bgPage.folderDocs.push(doc);
      else
        bgPage.docs.push(doc);
    }

    var nextLink = getLink(data.feed.link, 'next');
    if (nextLink) {
      getDocumentList(folderId, nextLink.href); // Fetch next page of results.
    } else {
      if (folderId) {
        appendAllDocsLink("Not in this directory? List all of my documents.");
        renderDocList(bgPage.folderDocs);
      } else {
        folderId = findPreviousBackupFolder();
        if (folderId)
          getDocumentList(folderId);
        else {
          appendAllDocsLink("Cannot find previous uploaded directory. List all my documents.");
          renderDocList([]);
        }
      }
    }
  };

  bgPage.oauth.sendSignedRequest(url, processDocListResults, params);
};
