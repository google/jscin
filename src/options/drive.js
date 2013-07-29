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