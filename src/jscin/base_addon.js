// Copyright 2013 Google Inc. All Rights Reserved.

/**
 * @fileoverview JSCIN Input Method Base Class.
 * @author hungte@google.com (Hung-Te Lin)
 */

export class BaseInputAddon {
  constructor(name, im) {
    this.im = im;
    this.name = name;
  }
  // Called when the IM is first initialized.
  init(ctx) {
    ctx.addon_prompt = undefined;
    return this.im.init(ctx);
  }
  // Called when IM or system wants to reset input context.
  reset_context(ctx) {
    ctx.addon_prompt = undefined;
    return this.im.reset_context(ctx);
  }

  // Called when a new key event is sent to IM.
  keystroke(ctx, ev) {
    return this.im.keystroke(ctx, ev);
  }

  // Called when system wants to query corresponding key strokes for given text.
  show_keystroke(ctx, text) {
    return this.im.show_keystroke(ctx, text);
  }

  // Called when terminates ongoing text input session without sending focus/blur
  // events, ex creating new tab / instance.
  reset(ctx) {
    return this.im.reset(ctx);
  }

  // Provides a notifier for IM to invoke when context has been modified.
  set_notifier(f) {
    return this.im.set_notifier(f);
  }

  // Used by IM to notify system something is changed (see set_notifier).
  notify() {
    return this.im.notify();
  }

  // Called when then system is going to shutdown IM.
  terminate(ctx) {
    return this.im.terminate(ctx);
  }
}
