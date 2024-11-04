// Copyright 2024 Google Inc. All Rights Reserved.

/**
 * @fileoverview IPC between iframe based components
 * @author hungte@google.com (Hung-Te Lin)
 */

const IME_EVENT_MESSAGE_TYPE = 'jscin.ime_event';

export class ImeEventMessage {
  constructor(event, ...args) {
    this.type = IME_EVENT_MESSAGE_TYPE;
    this.event = event;
    this.args = args;
  }
  getEvent() {
    return this.event;
  }
  getArgs() {
    return this.args;
  }
  dispatch(ime) {
    // TODO(hungte) change to ime[`on${this.getEvent()}`].dispatch
    return ime.dispatchEvent(this.getEvent(), ...this.getArgs());
  }
}

ImeEventMessage.fromObject = (obj) => {
  if (obj.type != IME_EVENT_MESSAGE_TYPE)
    return;
  return new ImeEventMessage(obj.event, ...obj.args);
}

const IME_COMMAND_MESSAGE_TYPE = 'jscin.ime_command';

export class ImeCommandMessage {
  constructor(command, parameters) {
    this.type = IME_COMMAND_MESSAGE_TYPE;
    this.command = command;
    this.parameters = parameters;
  }
  getCommand() {
    return this.command;
  }
  getParameters() {
    return this.parameters;
  }
  dispatch(ime) {
    return ime[this.getCommand()](this.getParameters());
  }
}

ImeCommandMessage.fromObject = (obj) => {
  if (obj.type != IME_COMMAND_MESSAGE_TYPE) {
    return;
  }
  return new ImeCommandMessage(obj.command, obj.parameters);
}
