/**
 * @fileoverview JsCIN external module protocol.
 */

// Add namespace if not defined yet.
if (typeof(jscin) == typeof(undefined)) {
  jscin = {};
}

jscin.external = {
  message_type: 'jscin_im_v1',

  cmd_register: 'register',
  cmd_keystroke: 'keystroke',

  id_any: '*',
  id_ime: 'cdkhibgadomdghgnknpmgegpjjmfecfk',
  // id_ime: 'adepkfapdlfphlicfcmpbnnkdngcildi',

  _debug: false,
  debug: function () {
    if (!this._debug)
      return;
    console.log.apply(console, ["[external]"].concat(
        Array.prototype.slice.apply(arguments)));
  },

  // JsCIN IM protocol v1:
  // jscin->im: {type: message_type, command: <command>, args: <args> }
  // im->jscin: {type: message_type, command: <command>,
  //             result: <result>, context: <context>}
  create_message: function (command) {
    return {type: this.message_type, command: command};
  },

  create_message_args: function (command) {
    var msg = this.create_message(command);
    msg.args = Array.prototype.slice.call(arguments, 1);
    return msg;
  },

  create_message_result: function (command, result, context) {
    var msg = this.create_message(command);
    msg.result = result;
    msg.context = context;
    return msg;
  },

  send_keystroke_command: function(context, ev, remote_id) {
    this.send_message(
        remote_id || this.id_ime,
        this.create_message_args(this.cmd_keystroke, context, ev));
  },

  send_keystroke_response: function(result, context, remote_id) {
    this.send_message(
        remote_id || this.id_ime,
        this.create_message_result(this.cmd_keystroke, result, context));
  },

  is_valid_message: function (message) {
    return message && message.type == this.message_type;
  },

  get_message_command: function (message) {
    return message.command;
  },

  get_message_args: function (message) {
    return message.args;
  },

  get_message_result: function (message) {
    return message.result;
  },

  get_message_context: function (message) {
    return message.context;
  },

  send_message: function (remote_id, message) {
    this.debug("send_message", remote_id, message);
    chrome.runtime.sendMessage(remote_id, message);
  },

  // External IM modules
  init_im: function (accept_id, dispatch) {
    var ext = jscin.external;
    chrome.runtime.onMessageExternal.addListener(
        function (request, sender, sendResponse) {
          if (sender.id != accept_id && accept_id != ext.id_any) {
            ext.debug("ignore message from", sender.id);
            return;
          }
          if (!ext.is_valid_message(request)) {
            ext.debug("invalid message", request);
            return;
          }
          var cmd = ext.get_message_command(request);
          if (cmd in dispatch) {
            ext.debug("dispatch command:", cmd);
            dispatch[cmd].apply(null, ext.get_message_args(request));
          } else {
            ext.debug("ignore: no dispatcher defined for command", cmd);
          }
        });
  },

  // JSCIN Host extension
  init_ime: function (accept_id, dispatch) {
    var ext = jscin.external;
    chrome.runtime.onMessageExternal.addListener(
        function (request, sender, sendResponse) {
          if (sender.id != accept_id && accept_id != ext.id_any) {
            ext.debug("ignore message from", sender.id);
            return;
          }
          if (!ext.is_valid_message(request)) {
            ext.debug("invalid message", request);
            return;
          }
          // TODO(hungte) Process register command.
          var cmd = ext.get_message_command(request);
          if (cmd in dispatch) {
            ext.debug("dispatch command:", cmd);
            dispatch[cmd].call(null, ext.get_message_result(request),
                               ext.get_message_context(request));
          } else {
            ext.debug("ignore: no dispatcher defined for command", cmd);
          }
        });
  },

  // Standard procedure to register an external IM into host IME.
  register: function (metadata_url, host_id) {
    host_id = host_id || this.id_ime;
    this.debug("regiester to ", host_id);
    this.send_message(host_id,
        this.create_message_args(this.cmd_register, metadata_url));
    // TODO(hungte) Return null when host_id can't be found.
    return host_id;
  },

  dummy: ''
};
