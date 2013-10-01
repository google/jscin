// Copyright 2013 Google Inc. All Rights Reserved.
/**
 * @fileoverview NaCl loader for libchewing.
 * @author hungte@google.com (Hung-Te Lin)
 */

#include <cstdio>
#include <string>

#include <pthread.h>  // for nacl_io
#include <stdlib.h>
#include <unistd.h>

#include "ppapi/cpp/instance.h"
#include "ppapi/cpp/module.h"
#include "ppapi/cpp/var.h"
#include "nacl_io/nacl_io.h"

#include "chewing.h"

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
  { "ShiftLeft", chewing_handle_ShiftLeft, },
  { "CapsLock", chewing_handle_Capslock, },
  { "Esc", chewing_handle_Esc, },
  { "Space", chewing_handle_Space, },
  { "PageUp", chewing_handle_PageUp, },
  { "PageDown", chewing_handle_PageDown, },
  { "End", chewing_handle_End, },
  { "Home", chewing_handle_Home, },
  { "ArrowLeft", chewing_handle_Left, },
  { "ArrowUp", chewing_handle_Up, },
  { "ArrowRight", chewing_handle_Right, },
  { "ArrowDown", chewing_handle_Down, },
  { "Delete", chewing_handle_Del, },
};

static int chewing_SelKeys[11] = {
  '1','2','3','4','5','6','7','8','9','0',0,
};

void *chewing_init_context(void *arg);

class ChewingInstance: public pp::Instance {
 public:
  ChewingContext *ctx;
  explicit ChewingInstance(PP_Instance instance): pp::Instance(instance) {
    char chewing_path[] = "CHEWING_PATH=/data";
    nacl_io_init_ppapi(instance, pp::Module::Get()->get_browser_interface());
    ctx = NULL;
    putenv(chewing_path);
    if (mount("libchewing/data", "/data", "httpfs", 0, "") != 0) {
      PostMessage(pp::Var("can't mount"));
      return;
    }
    pthread_t main_thread;
    pthread_create(&main_thread, NULL, chewing_init_context, (void*)this);
  }
  virtual ~ChewingInstance() {
    if (ctx)
      chewing_delete(ctx);
  }
  virtual void HandleMessage(const pp::Var &var_message) {
    // Due to current PPAPI limitation, we need to serialize anything to simple
    // string before sending to native client.
    if (!var_message.is_string())
      return;

    // Check message type.
    string msg(var_message.AsString());
    const string kOnKeystroke = "onKeystroke:";
    if (msg.find_first_of(kOnKeystroke) != 0)
      return;
    msg = msg.substr(kOnKeystroke.size());

    bool handled = false;
    for (int i = 0; i < ARRAYSIZE(special_key_mappings); i++) {
      ChewingKeyMapping *map = &special_key_mappings[i];
      if (msg == map->keyname) {
        map->handler(ctx);
        handled =true;
        break;
      }
    }
    PostMessage(pp::Var(handled ? "handled" : "not handled"));

    if (!handled)
        chewing_handle_Default(ctx, msg[0]);

    if (chewing_commit_Check(ctx)) {
      char *s = chewing_commit_String(ctx);
      // TODO(hungte) Encode results.
      PostMessage(pp::Var(s));
      free(s);
    }
  }
};

void *chewing_init_context(void *arg) {
  ChewingInstance *instance = (ChewingInstance*)arg;
  ChewingContext *ctx = chewing_new();
  instance->ctx = ctx;
  // Set keyboard type
  chewing_set_KBType(instance->ctx, chewing_KBStr2Num((char*)"KB_DEFAULT"));

  chewing_set_candPerPage(ctx, 9);
  chewing_set_maxChiSymbolLen(ctx, 16);
  chewing_set_addPhraseDirection(ctx, 1);
  chewing_set_selKey(ctx, chewing_SelKeys, 10);
  chewing_set_spaceAsSelection(ctx, 1);
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
