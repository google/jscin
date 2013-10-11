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

#include <pthread.h>  // for nacl_io
#include <stdlib.h>
#include <unistd.h>

#include "ppapi/cpp/instance.h"
#include "ppapi/cpp/module.h"
#include "ppapi/cpp/var.h"
#include "nacl_io/nacl_io.h"
#include "json/writer.h"

#include "chewing.h"
#include "chewing-private.h"

using std::string;

#define ARRAYSIZE(x) (sizeof(x)/sizeof(x[0]))

extern "C" size_t getpagesize() {
  return sysconf(_SC_PAGESIZE);
}

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

    const char *data_dir = "/data", *user_data_dir = "/user_data";
    nacl_io_init_ppapi(instance, pp::Module::Get()->get_browser_interface());
    if (mount("libchewing/data", data_dir, "httpfs", 0, "") != 0) {
      PostMessage(pp::Var("can't mount data"));
      return;
    }
    // TODO(hungte) change memfs to html5fs.
    if (mount("", user_data_dir, "html5fs", 0,
              "type=PERSISTENT,expected_size=1048576") != 0) {
      PostMessage(pp::Var("can't mount user data"));
      return;
    }
    // Note chewing library does not really take path on its Init...
    // So we always need to do putenv.
    char chewing_path[] = "CHEWING_PATH=/data";
    char chewing_user_path[] = "CHEWING_USER_PATH=/user_data";
    putenv(chewing_path);
    putenv(chewing_user_path);
    chewing_Init(data_dir, ".");
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
    char *text = (char*)calloc(to - from + 1, MAX_UTF8_SIZE);
    for (int i = from; i < to; i++) {
      strcat(text, (char *)ctx->output->chiSymbolBuf[i].s);
    }
    array.append(Json::Value(text));
    free(text);
  }

  virtual void ReturnContext() {
    char *s;
    Json::FastWriter writer;
    Json::Value value(Json::objectValue);

    // TODO(hungte) Probably just access context internal buffer so we don't
    // need to waste time doing calloc/free... reading ChewingOutput directly.

    // chewing_cand_CheckDone does not do what we expect...
    if (chewing_cand_TotalChoice(ctx) > 0) {
      chewing_cand_Enumerate(ctx);
      Json::Value cand = Json::Value(Json::arrayValue);
      int i, len = chewing_cand_ChoicePerPage(ctx);
      for (i = 0; i < len && chewing_cand_hasNext(ctx); i++) {
        s = chewing_cand_String(ctx);
        cand.append(Json::Value(s));
        chewing_free(s);
      }
      value["cand"] = cand;
      value["cand_ChoicePerPage"] = Json::Value(len);
      value["cand_TotalPage"] = Json::Value(chewing_cand_TotalPage(ctx));
      value["cand_CurrentPage"] = Json::Value(chewing_cand_CurrentPage(ctx));
    }

    if (chewing_buffer_Check(ctx)) {
      s = chewing_buffer_String(ctx);
      value["buffer"] = Json::Value(s);
      chewing_free(s);
    }

    {
      IntervalType it;
      Json::Value intervals = Json::Value(Json::arrayValue);
      Json::Value lcch = Json::Value(Json::arrayValue);
      chewing_interval_Enumerate(ctx);
      int start = 0, end = chewing_buffer_Len(ctx);
      // TODO(hungte) It is possible to have groups without buffer.
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

    // TODO(hungte) Remove the "#if 0" after v0.3.6 is released.
#if 0
    if (chewing_bopomofo_Check(ctx)) {
      s = chewing_bopomofo_String(ctx);
      value["bopomofo"] = Json::Value(s);
      chewing_free(s);
    }
#else
    if (!chewing_zuin_Check(ctx)) {
      s = chewing_zuin_String(ctx, NULL);
      value["bopomofo"] = Json::Value(s);
      chewing_free(s);
    }
#endif

    if (chewing_aux_Check(ctx)) {
      s = chewing_aux_String(ctx);
      value["aux"] = Json::Value(s);
      chewing_free(s);
    }
    if (chewing_commit_Check(ctx)) {
      s = chewing_commit_String(ctx);
      value["commit"] = Json::Value(s);
      chewing_free(s);
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
    Json::Value v(chewing_get_KBString(ctx));
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

void *chewing_init_context(void *arg) {
  int selkeys[MAX_SELKEY] = {'1', '2', '3', '4', '5', '6', '7', '8', '9', '0'};

  ChewingInstance *instance = (ChewingInstance*)arg;
  /* chewing_new will do fopen/fread so we must call it inside a dedicated
   * thread. */
  ChewingContext *ctx = chewing_new();

  chewing_set_maxChiSymbolLen(ctx, 16);
  chewing_set_addPhraseDirection(ctx, 1);
  chewing_set_spaceAsSelection(ctx, 1);
  // chewing_set_selKey does not really take the len arg and takes a hard-coded
  // value for memcpy size. How amazing!
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
