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

export function parseGtab(arraybuffer) {

  var MAX_GTAB_QUICK_KEYS = 46;
  var CH_SZ = 4;

  function decode_utf8(s) {
    return decodeURIComponent(escape(s));
  }

  function checkAndConcat(key, ch) {
    if(key[0] == '%') {
      throw "key cannot start with '%'";
    }
    if(/\s/.test(key)) {
      throw "key cannot contain space characters";
    }
    return key + ' ' + ch + '\n';
  }

  function MyView (view) {
    this.view = view;
    this.offset = 0;
    this.littleEndian = false;
  }

  MyView.prototype.getUint8 = function() {
    return this.view.getUint8(this.offset++);
  };

  MyView.prototype.getUint32 = function() {
    var n = this.view.getUint32(this.offset, this.littleEndian);
    this.offset += 4;
    return n;
  }

  MyView.prototype.getUint64 = function() {
    var n = this.view.getUint64(this.offset, this.littleEndian);
    this.offset += 8;
    return n;
  }

  MyView.prototype.getString = function(len) {
    var ret = '';
    for(var j = 0; j < len; j++) {
      var c = this.view.getUint8(this.offset + j);
      if(c == 0) {
        break;
      }
      ret += String.fromCharCode(c);
    }
    this.offset += len;
    return decode_utf8(ret);
  }

  MyView.prototype.detectEndian = function() {
    var KeyS_first_byte = this.view.getUint8(56);
    // key size should not be more than 255
    if(KeyS_first_byte) {
      this.littleEndian = true;
    } else {
      this.littleEndian = false;
    }
  }

  var cin = '';
  var myView = new MyView(new DataView(arraybuffer));
  var th = {};

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

  th.qkeys = {};
  th.qkeys.quick1 = [];
  for(var j = 0; j < MAX_GTAB_QUICK_KEYS; j++) {
    th.qkeys.quick1[j] = [];
    for(var k = 0; k < 10; k++) {
      th.qkeys.quick1[j][k] = myView.getString(CH_SZ);
    }
  }
  th.qkeys.quick2 = [];
  for(var j = 0; j < MAX_GTAB_QUICK_KEYS; j++) {
    th.qkeys.quick2[j] = [];
    for(var k = 0; k < MAX_GTAB_QUICK_KEYS; k++) {
      th.qkeys.quick2[j][k] = [];
      for(var l = 0; l < 10; l++) {
        th.qkeys.quick2[j][k][l] = myView.getString(CH_SZ);
      }
    }
  }

  th.endkey = myView.getString(99);

  th.keybits = myView.getUint8();
  if(th.keybits < 6 || th.keybits > 7) // keybits is always 6 or 7
    th.keybits = 6;
  var key64 = (th.MaxPress*th.keybits > 32);

  th.selkey += myView.getString(12);
  cin += ('%selkey ' + th.selkey + '\n');

  myView.offset += 16; // th.dummy

  var keymap = myView.getString(th.KeyS);

  var kname = [];
  for(var j = 0; j < th.KeyS; j++) {
    kname[j] = myView.getString(CH_SZ);
  }

  cin += '%keyname begin\n';
  for(var j = 1; j < th.KeyS; j++) {
    cin += checkAndConcat(keymap[j], kname[j]);
  }
  cin += '%keyname end\n';

  myView.offset += 4 * (th.KeyS + 1); // skip parsing idx since it's unused

  cin += '%chardef begin\n';
  var LAST_K_bitN = (Math.floor((key64 ? 64:32) / th.keybits) - 1) * th.keybits;
  var itout = [];
  for(var j = 0; j < th.DefC; j++) {
    var keyUint;
    if(key64) {
      keyUint = myView.getUint64();
    } else {
      keyUint = myView.getUint32();
    }

    var mask = (1 << th.keybits) - 1;
    var keyString = '';
    for(var k = 0; k < th.MaxPress; k++) {
      var c = (keyUint >> (LAST_K_bitN - k * th.keybits)) & mask;
      if(c == 0) {
        break;
      }
      keyString += keymap[c];
    }

    var ch = myView.getString(CH_SZ);
    cin += checkAndConcat(keyString, ch);
  }
  cin += '%chardef end\n';

  return cin;
}
