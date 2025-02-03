const apply = Reflect.apply;
const defineProperty = Reflect.defineProperty;
const getOwnPropertyDescriptor = Reflect.getOwnPropertyDescriptor;

const MAGIC = "__$$postMessage$$__";
const FRAME_ID = `${+new Date()}_${Math.floor(Math.random() * 1000)}`;

function wrapPostMessage(callbackMeta) {
  function createEnvelope(data) {
    return {
      data,
      meta: callbackMeta(data),
      [MAGIC]: FRAME_ID,
    };
  }

  const global_postMessage = global.postMessage;

  global.postMessage = function () {
    const [data, ...rest] = arguments;

    return apply(global_postMessage, this, [createEnvelope(data), ...rest]);
  };

  const MessagePort_proto = MessagePort.prototype;
  const MessagePort_proto_postMessage = MessagePort_proto.postMessage;

  MessagePort_proto.postMessage = function () {
    const [data, ...rest] = arguments;

    return apply(MessagePort_proto_postMessage, this, [
      createEnvelope(data),
      ...rest,
    ]);
  };

  const MessageEvent_proto = MessageEvent.prototype;
  const MessageEvent_proto_data = getOwnPropertyDescriptor(
    MessageEvent_proto,
    "data"
  ).get;

  defineProperty(MessageEvent_proto, "data", {
    enumerable: true,
    configurable: true,
    get: function () {
      const envelope = apply(MessageEvent_proto_data, this, []);
      return envelope && envelope[MAGIC] ? envelope.data : envelope;
    },
  });

  defineProperty(MessageEvent_proto, "meta", {
    enumerable: true,
    configurable: true,
    get: function () {
      const envelope = apply(MessageEvent_proto_data, this, []);
      return envelope && envelope[MAGIC] === FRAME_ID ? envelope.meta : null;
    },
  });
}

module.exports = wrapPostMessage;
