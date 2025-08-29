// typedef struct {
//   char quick1[MAX_GTAB_QUICK_KEYS][10][CH_SZ];
//   char quick2[MAX_GTAB_QUICK_KEYS][MAX_GTAB_QUICK_KEYS][10][CH_SZ];
// } QUICK_KEYS;

// struct TableHead {
//   int version;
//   u_int flag;
//   char cname[32];         /* prompt */
//   char selkey[12];        /* select keys */
//   GTAB_space_pressed_E space_style;
//   int KeyS;               /* number of keys needed */
//   int MaxPress;           /* Max len of keystroke  ar30:4  changjei:5
//   int M_DUP_SEL;          /* how many keys used to select */
//   int DefC;               /* Defined characters */
//   QUICK_KEYS qkeys;

//   union {
//     struct {
//       char endkey[99];
//       char keybits;
//       char selkey2[10];
//     };

//     char dummy[128];  // for future use
//   };
// };

const debugFlag = false;

function debug(...args) {
  if (debugFlag)
    console.log(...args);
}

export function IsGTabBlob(blob) {
  /* The TableHead is very large - roughly 86779 bytes. */
  debug("IsGTabBlob: blob length:", blob.byteLength);
  if (blob.byteLength < 0x15300)
    return false;

  // from gtab_parser, the gtab files start with int32 'version' and it's
  // usually 0x00, at least unlikely to be a printable string. For CIN files,
  // the starting byte is usually printable, or 0xEF for UTF8 BOM. So we can
  // quickly decide the type by checking the first byte.
  let leading_byte = new Uint8Array(blob.slice(0, 1))[0];
  if (leading_byte >= 32) {
    debug("IsGTabBlob: invalid leading byte:", leading_byte);
    return false;
  }
  debug("IsGTabBlob: Looks like a GTAB.");
  return true;
}

function decode_utf8(s) {
  return decodeURIComponent(escape(s));
}

class MyView {
  constructor(view) {
    this.view = view;
    this.offset = 0;
    this.littleEndian = false;
    this.byteLength = view.byteLength;
  }

  getUint8() {
    return this.view.getUint8(this.offset++);
  };

  getUint32() {
    let n = this.view.getUint32(this.offset, this.littleEndian);
    this.offset += 4;
    return n;
  }

  getUint64() {
    let n = this.view.getBigUint64(this.offset, this.littleEndian);
    this.offset += 8;
    return n;
  }

  getBytes(len) {
    let r = [];
    for (let i = 0; i < len; i++) {
      let c = this.view.getUint8(this.offset + i);
      r.push(c);
    }
    this.offset += len;
    return r;
  }

  getItemCh() {
    const len = 4;  // CHSZ
    let bytes = this.getBytes(len);
    if (bytes[0] & 0x80)
      return decode_utf8(bytes.map((v)=> v ? String.fromCharCode(v) : '').join(''));
    return bytes[0] << 16 | bytes[1] << 8 | bytes[2];
  }

  getString(len) {
    let ret = '';
    for(let j = 0; j < len; j++) {
      let c = this.view.getUint8(this.offset + j);
      if(c == 0) {
        break;
      }
      ret += String.fromCharCode(c);
    }
    this.offset += len;
    return decode_utf8(ret);
  }

  detectEndian() {
    let KeyS_first_byte = this.view.getUint8(56);
    // key size should not be more than 255
    this.littleEndian = !!KeyS_first_byte;
  }

  EOF() {
    return this.offset >= this.byteLength;
  }
}

export function parseGtab(arraybuffer) {

  let MAX_GTAB_QUICK_KEYS = 46;
  let CH_SZ = 4;

  function checkAndConcat(key, ch) {
    if(key[0] == '%') {
      throw "key cannot start with '%'";
    }
    if(/\s/.test(key)) {
      throw "key cannot contain space characters";
    }
    return key + ' ' + ch + '\n';
  }

  let cin = '';
  let th = {};
  let myView = new MyView(new DataView(arraybuffer));

  myView.detectEndian();

  th.version = myView.getUint32();
  th.flag = myView.getUint32();

  th.cname = myView.getString(32);
  cin += ('%cname ' + th.cname + '\n');

  th.selkey = myView.getString(12); // will write to cin after selkey2

  th.space_style = myView.getUint32();
  th.KeyS = myView.getUint32();
  th.MaxPress = myView.getUint32();
  th.M_DUP_SEL = myView.getUint32();
  th.DefC = myView.getUint32();

  // Indication of invalid composition in Array quick keys.
  const INVALID_QUICK_KEY = '\u25a1';

  th.qkeys = {};
  th.qkeys.quick1 = [];
  for(let j = 0; j < MAX_GTAB_QUICK_KEYS; j++) {
    th.qkeys.quick1[j] = [];
    let found = false;
    for(let k = 0; k < 10; k++) {
      let s = myView.getString(CH_SZ);
      if (s)
        found = true;
      // TODO(hungte): Decide INVALID_QUICK_KEY after scanning the whole qkeys.
      th.qkeys.quick1[j][k] = s|| INVALID_QUICK_KEY;
    }
    // Filter out all-invalid entries
    if (!found)
      th.qkeys.quick1[j] = [];
  }
  th.qkeys.quick2 = [];
  for(let j = 0; j < MAX_GTAB_QUICK_KEYS; j++) {
    th.qkeys.quick2[j] = [];
    for(let k = 0; k < MAX_GTAB_QUICK_KEYS; k++) {
      th.qkeys.quick2[j][k] = [];
      let found = false;
      for(let l = 0; l < 10; l++) {
        let s = myView.getString(CH_SZ);
        if (s)
          found = true;
        th.qkeys.quick2[j][k][l] = s || INVALID_QUICK_KEY;
      }
      // Filter out all-invalid entries
      if (!found)
        th.qkeys.quick2[j][k] = [];
    }
  }

  th.endkey = myView.getString(99);

  th.keybits = myView.getUint8();
  if(th.keybits < 6 || th.keybits > 7) // keybits is always 6 or 7
    th.keybits = 6;
  let key64 = (th.MaxPress*th.keybits > 32);

  th.selkey += myView.getString(12);
  cin += ('%selkey ' + th.selkey + '\n');

  myView.offset += 16; // th.dummy

  let keymap = myView.getString(th.KeyS);

  let kname = [];
  for(let j = 0; j < th.KeyS; j++) {
    kname[j] = myView.getString(CH_SZ);
  }

  cin += '%keyname begin\n';
  for(let j = 1; j < th.KeyS; j++) {
    cin += checkAndConcat(keymap[j], kname[j]);
  }
  cin += '%keyname end\n';

  myView.offset += 4 * (th.KeyS + 1); // skip parsing idx since it's unused

  // GTAB actually combines multiple %flag_* in CIN into the binary flag and
  // there is no '%flag' command. However we want to put the parsing of flags in
  // the jscin IM modules (so we can handle new tables by an update) so we have
  // to store that using a fake '%flag'. One exception is the 0x01
  // %keep_key_case because that will change the CIN file parsing.
  cin += `%flag ${th.flag}\n`;
  if (th.flag & 0x01) {
    cin += '%keep_key_case\n';
  }
  cin += `%space_style ${th.space_style}\n`;
  if (th.MaxPress)
    cin += `%max_keystroke ${th.MaxPress}\n`;

  let qs = '';

  th.qkeys.quick1.forEach((v, j) => {
    if (!v.length)
      return;
    let s = checkAndConcat(keymap[j + 1], v.join(''));
    qs += s;
  });

  th.qkeys.quick2.forEach((w, j) => {
    w.forEach((v, k) => {
      if (!v.length)
        return;
      let s = checkAndConcat(keymap[j + 1] + keymap[k + 1], v.join(''));
      qs += s;
    });
  });

  if (qs) {
    cin += `%nullcandidate ${INVALID_QUICK_KEY}\n`; // CIN2 v2.1
    cin += `%quick begin\n${qs}%quick end\n`;
  }

  // decode chardef; but we have to decide ITEMS[64] table and phrases first.

  let LAST_K_bitN = (Math.floor((key64 ? 64:32) / th.keybits) - 1) * th.keybits;
  let itout = [];
  for(let j = 0; j < th.DefC; j++) {
    let keyUint;
    if(key64) {
      keyUint = myView.getUint64();
    } else {
      keyUint = BigInt(myView.getUint32());
    }

    let mask = (1 << th.keybits) - 1;
    let keyString = '';
    for(let k = 0; k < th.MaxPress; k++) {
      let c = (keyUint >> BigInt(LAST_K_bitN - k * th.keybits)) & BigInt(mask);
      if(c == 0) {
        break;
      }
      keyString += keymap[c];
    }

    let ch = myView.getItemCh();
    itout.push([keyString, ch]);
  }

  let phrases = [];

  if (!myView.EOF()) {
    let phrnum = myView.getUint32();
    let phridx = [];
    for (let i = 0; i < phrnum; i++) {
      phridx.push(myView.getUint32());
    }
    for (let i = 0; i < phrnum-1; i++) {
      let size = phridx[i+1] - phridx[i];
      let s = myView.getString(size);
      phrases.push(s);
    }
  }

  cin += '%chardef begin\n';
  for (let [keyString, ch] of itout) {
    if (typeof(ch) == 'number') {
      if (!phrases[ch])
        console.error("gtab: Invalid chardef:", keyString, ch);
      ch = phrases[ch];
    }
    cin += checkAndConcat(keyString, ch);
  }
  cin += '%chardef end\n';

  return cin;
}
