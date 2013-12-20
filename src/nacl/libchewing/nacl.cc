// Copyright 2013 Google Inc. All Rights Reserved.
/**
 * @fileoverview NaCl loader for libchewing.
 * @author hungte@google.com (Hung-Te Lin)
 *
 * Accept messages:
 *  key:<KEY NAME>
 *
 * Output messages:
 *  debug:<DEBUG MESSAGE>
 *  context:<IM context>
 */

#include <stdio.h>
#include <string.h>
#include <math.h>

#include <stdlib.h>
#include <stdarg.h>
#include <unistd.h>
#include <sys/mount.h>

#include <pthread.h>  // for nacl_io

#include "ppapi/cpp/instance.h"
#include "ppapi/cpp/module.h"
#include "ppapi/cpp/var.h"
#include "nacl_io/nacl_io.h"
#include "json/writer.h"

#include "chewing.h"
#include "chewing-private.h"

using std::string;

#define ARRAYSIZE(x) (sizeof(x)/sizeof(x[0]))

////////////////////////////////////////////////////////////////////////
// Module Initialization.
////////////////////////////////////////////////////////////////////////

typedef struct {
  const char *keyname;
  int (*handler)(ChewingContext *ctx);
} ChewingKeyMapping;

ChewingKeyMapping special_key_mappings[] = {
  { "Backspace", chewing_handle_Backspace, },
  { "Tab", chewing_handle_Tab, },
  { "Enter", chewing_handle_Enter, },
  { "Shift", chewing_handle_ShiftLeft, },
  { "CapsLock", chewing_handle_Capslock, },
  { "Esc", chewing_handle_Esc, },
  { " ", chewing_handle_Space, },
  { "PageUp", chewing_handle_PageUp, },
  { "PageDown", chewing_handle_PageDown, },
  { "End", chewing_handle_End, },
  { "Home", chewing_handle_Home, },
  { "Left", chewing_handle_Left, },
  { "Up", chewing_handle_Up, },
  { "Right", chewing_handle_Right, },
  { "Down", chewing_handle_Down, },
  { "Delete", chewing_handle_Del, },
};

void *chewing_init_context(void *arg);

#define USER_DATA_DIR "/home"
#define DATA_DIR      "/data"

class ChewingInstance: public pp::Instance {
 protected:
  const string kMsgDebugPrefix;
  const string kMsgContextPrefix;
  const string kMsgKeyPrefix;
  const string kMsgLayoutPrefix;

 public:
  ChewingContext *ctx;

  explicit ChewingInstance(PP_Instance instance): pp::Instance(instance),
      kMsgDebugPrefix("debug:"), kMsgContextPrefix("context:"),
      kMsgKeyPrefix("key:"), kMsgLayoutPrefix("layout:"), ctx(NULL) {

    nacl_io_init_ppapi(instance, pp::Module::Get()->get_browser_interface());

    if (mount("libchewing/data", DATA_DIR, "httpfs", 0, "") != 0) {
      PostMessage(pp::Var("can't mount data"));
      return;
    }

    // TODO(hungte) Change memfs to html5fs once we've figured out why it does
    // not work.
    if (mount("", USER_DATA_DIR, "memfs", 0,
              "type=PERSISTENT,expected_size=1048576") != 0) {
      PostMessage(pp::Var("can't mount user data"));
      return;
    }

    // Note chewing library does not really take path on its Init...
    // So we always need to do putenv.
    setenv("CHEWING_PATH", DATA_DIR, 1);
    setenv("CHEWING_USER_PATH", USER_DATA_DIR, 1);

    // Blank out USER, LOGNAME and set HOME so sqlite won't go crazy.
    setenv("HOME", USER_DATA_DIR, 1);
    setenv("USER", "", 1);
    setenv("LOGNAME", "", 1);
    chewing_Init(DATA_DIR, USER_DATA_DIR);

    pthread_t main_thread;
    pthread_create(&main_thread, NULL, chewing_init_context, (void*)this);
  }

  virtual ~ChewingInstance() {
    if (ctx)
      chewing_delete(ctx);
    chewing_Terminate();
  }

  virtual void Debug(const string &message, const string &detail="") {
    PostMessage(pp::Var(kMsgDebugPrefix + message + (
        detail.empty() ? ", " : "") + detail));
  }

  virtual void AppendChewingBuffer(Json::Value &array, int from, int to) {
    /* TODO(hungte) Use chewing_buffer_String_static(ctx) in future.
     * Currently that does not allow us fetching particular characters inside
     * buffer.
     */
    char *text = (char*)calloc(to - from + 1, MAX_UTF8_SIZE);
    for (int i = from; i < to; i++) {
      strcat(text, (char *)ctx->data->preeditBuf[i].char_);
    }
    array.append(Json::Value(text));
    free(text);
  }

  virtual void ReturnContext() {
    const char *s;
    Json::FastWriter writer;
    Json::Value value(Json::objectValue);

    // chewing_cand_CheckDone does not do what we expect...
    if (chewing_cand_TotalChoice(ctx) > 0) {
      chewing_cand_Enumerate(ctx);
      Json::Value cand = Json::Value(Json::arrayValue);
      int i, len = chewing_cand_ChoicePerPage(ctx);
      for (i = 0; i < len && chewing_cand_hasNext(ctx); i++) {
        s = chewing_cand_String_static(ctx);
        cand.append(Json::Value(s));
      }
      value["cand"] = cand;
      value["cand_ChoicePerPage"] = Json::Value(len);
      value["cand_TotalPage"] = Json::Value(chewing_cand_TotalPage(ctx));
      value["cand_CurrentPage"] = Json::Value(chewing_cand_CurrentPage(ctx));
    }

    if (chewing_buffer_Check(ctx)) {
      value["buffer"] = Json::Value(chewing_buffer_String_static(ctx));
    }

    {
      IntervalType it;
      Json::Value intervals = Json::Value(Json::arrayValue);
      Json::Value lcch = Json::Value(Json::arrayValue);
      chewing_interval_Enumerate(ctx);
      int start = 0, end = chewing_buffer_Len(ctx);
      // Note It is possible to have groups without buffer.
      // i.e., lcch>0, intervals=0
      while (chewing_interval_hasNext(ctx)) {
        chewing_interval_Get(ctx, &it);
        Json::Value itv = Json::Value(Json::objectValue);
        itv["from"] = Json::Value(it.from);
        itv["to"] = Json::Value(it.to);
        intervals.append(itv);

        if (start != it.from)
          AppendChewingBuffer(lcch, start, it.from);
        AppendChewingBuffer(lcch, it.from, it.to);
        start = it.to;
      }
      if (start < end)
        AppendChewingBuffer(lcch, start, end);
      if (intervals.size() > 0)
        value["interval"] = intervals;
      if (lcch.size() > 0)
        value["lcch"] = lcch;
    }

    if (chewing_bopomofo_Check(ctx)) {
      value["bopomofo"] = Json::Value(chewing_bopomofo_String_static(ctx));
    }

    if (chewing_aux_Check(ctx)) {
      value["aux"] = Json::Value(chewing_aux_String_static(ctx));
    }
    if (chewing_commit_Check(ctx)) {
      value["commit"] = Json::Value(chewing_commit_String_static(ctx));
    }
    value["cursor"] = Json::Value(chewing_cursor_Current(ctx));
    if (chewing_keystroke_CheckIgnore(ctx))
      value["ignore"] = Json::Value(true);
    if (chewing_keystroke_CheckAbsorb(ctx))
      value["absorb"] = Json::Value(true);

    // XCIN compatible fields
    value["keystroke"] = value["bopomofo"];
    value["mcch"] = value["cand"];
    value["cch"] = value["commit"];
    value["edit_pos"] = value["cursor"];
    // lcch should be already handled when building interval.

    PostMessage(pp::Var(kMsgContextPrefix + writer.write(value)));
  }

  virtual void ReturnLayout(Json::Value value) {
    Json::FastWriter writer;
    PostMessage(pp::Var(kMsgLayoutPrefix + writer.write(value)));
  }

  virtual void ProcessKeyMessage(const string &key) {
    bool handled = false;
    for (int i = 0; i < ARRAYSIZE(special_key_mappings); i++) {
      ChewingKeyMapping *map = &special_key_mappings[i];
      if (key == map->keyname) {
        map->handler(ctx);
        handled = true;
        break;
      }
    }
    // Some special keys, like Ctrl, should not be mis-handled.
    if (!handled && key.size() == 1) {
        chewing_handle_Default(ctx, key[0]);
    }
    ReturnContext();
  }

  virtual void ProcessLayoutMessage(const string &layout) {
    // TODO(hungte) Remove the (char*) when chewing_KBStr2Num has changed to
    // const char *.
    chewing_set_KBType(ctx, chewing_KBStr2Num((char*)layout.c_str()));
    /* TODO(hungte) Change this to:
     *  (1) enumerate and cache chewing_kbtype_string_staci list
     *  (2) lookup chewing_get_KBType
     */
    char *s = chewing_get_KBString(ctx);
    Json::Value v(s);
    chewing_free(s);
    ReturnLayout(v);
  }

  virtual void HandleMessage(const pp::Var &var_message) {
    // Due to current PPAPI limitation, we need to serialize anything to simple
    // string before sending to native client.
    if (!ctx || !var_message.is_string())
      return;

    // Check message type.
    string msg(var_message.AsString());

    if (msg.find_first_of(kMsgKeyPrefix) == 0) {
      msg = msg.substr(kMsgKeyPrefix.size());
      ProcessKeyMessage(msg);
      return;
    }
    if (msg.find_first_of(kMsgLayoutPrefix) == 0) {
      msg = msg.substr(kMsgLayoutPrefix.size());
      ProcessLayoutMessage(msg);
      return;
    }
    Debug("Unknown command", msg);
  }
};

#ifdef DEBUG

#define CHEWING_LOG_PREFIX  "[chewing] "
extern "C" void chewingLogger(void *data, int level, const char *fmt, ... ) {
  static char buf[256] = CHEWING_LOG_PREFIX;
  va_list ap;
  ChewingInstance *instance = (ChewingInstance *)data;

  va_start(ap, fmt);
  vsnprintf(buf + sizeof(CHEWING_LOG_PREFIX) - 1,
            sizeof(buf) - sizeof(CHEWING_LOG_PREFIX), fmt, ap);
  va_end(ap);
  instance->Debug(buf);
}

static void testUserDir(ChewingInstance *instance) {
  int fd = open(USER_DATA_DIR "/test.b", O_CREAT | O_WRONLY, 0777);
  if (fd < 0) {
    instance->Debug("Failed to create file inside USER_DATA_DIR");
  }
  else if (write(fd, "test", 4) != 4) {
    instance->Debug("Failed to write content into test.b");
  }
  else if (close(fd) != 0) {
    instance->Debug("Failed to close test.b");
  }
  if (mkdir(USER_DATA_DIR "/blah.db", 0777) != 0) {
    instance->Debug("Failed to create USER_DATA_DIR/blah.db");
  }
}
#endif

void *chewing_init_context(void *arg) {
  // TODO(hungte) Rewrite by PPAPI_SIMPLE_REGISTER_MAIN.
  ChewingInstance *instance = (ChewingInstance*)arg;

#ifdef DEBUG
  testUserDir(instance);
#endif

  /* chewing_new will do fopen/fread so we must call it inside a dedicated
   * thread. */
  ChewingContext *ctx = chewing_new();
  if (!ctx) {
    instance->Debug("ERROR: Failed to create chewing context.\n");
    return NULL;
  }

#ifdef DEBUG
  chewing_set_logger(ctx, chewingLogger, instance);
#endif

  chewing_set_maxChiSymbolLen(ctx, 32);
  chewing_set_addPhraseDirection(ctx, 1);
  chewing_set_spaceAsSelection(ctx, 1);
  // chewing_set_selKey does not really take the len arg and takes a hard-coded
  // value for memcpy size. How amazing!
  int selkeys[MAX_SELKEY] = {'1', '2', '3', '4', '5', '6', '7', '8', '9', '0'};
  int nSelKeys = ARRAYSIZE(selkeys);
  assert(nSelKeys >= MAX_SELKEY);
  chewing_set_selKey(ctx, selkeys, nSelKeys);
  chewing_set_candPerPage(ctx, std::min(nSelKeys, MAX_SELKEY));
  instance->ctx = ctx;
  return NULL;
}

class ChewingModule: public pp::Module {
 public:
  ChewingModule(): pp::Module() {}
  virtual ~ChewingModule() {}

  virtual pp::Instance* CreateInstance(PP_Instance instance) {
    return new ChewingInstance(instance);
  }
};

namespace pp {
  Module* CreateModule() {
    return new ChewingModule();
  }
}  // namespace pp
