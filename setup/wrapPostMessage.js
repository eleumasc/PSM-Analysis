const $Reflect$apply = Reflect.apply;
const $Reflect$defineProperty = Reflect.defineProperty;
const $Reflect$getOwnPropertyDescriptor = Reflect.getOwnPropertyDescriptor;

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

  const $postMessage = global.postMessage;

  global.postMessage = function () {
    const [data, ...rest] = arguments;

    return $Reflect$apply($postMessage, this, [createEnvelope(data), ...rest]);
  };

  const $MessagePort$proto = MessagePort.prototype;
  const $MessagePort$proto$postMessage = $MessagePort$proto.postMessage;

  $MessagePort$proto.postMessage = function () {
    const [data, ...rest] = arguments;

    return $Reflect$apply($MessagePort$proto$postMessage, this, [
      createEnvelope(data),
      ...rest,
    ]);
  };

  const $MessageEvent$proto = MessageEvent.prototype;
  const $MessageEvent$proto$data = $Reflect$getOwnPropertyDescriptor(
    $MessageEvent$proto,
    "data"
  ).get;

  $Reflect$defineProperty($MessageEvent$proto, "data", {
    enumerable: true,
    configurable: true,
    get: function () {
      const envelope = $Reflect$apply($MessageEvent$proto$data, this, []);
      return envelope && envelope[MAGIC] ? envelope.data : envelope;
    },
  });

  $Reflect$defineProperty($MessageEvent$proto, "meta", {
    enumerable: true,
    configurable: true,
    get: function () {
      const envelope = $Reflect$apply($MessageEvent$proto$data, this, []);
      return envelope && envelope[MAGIC] === FRAME_ID ? envelope.meta : null;
    },
  });
}

module.exports = wrapPostMessage;
