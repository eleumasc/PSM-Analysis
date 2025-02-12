// "use strict";

const getOrCreateMapEntry = require("./util/getOrCreateMapEntry");
const Map = require("./safe/Map");
const WeakMap = require("./safe/WeakMap");

const apply = Reflect.apply;
const defineProperty = Reflect.defineProperty;
const getOwnPropertyDescriptor = Reflect.getOwnPropertyDescriptor;
const ownKeys = Reflect.ownKeys;
const Boolean = global.Boolean;
const String = global.String;

function wrapListeners(buildListenerWrapper, buildCallbackWrapper) {
  buildListenerWrapper =
    buildListenerWrapper ||
    function (_target, _type, listener) {
      return listener;
    };
  buildCallbackWrapper =
    buildCallbackWrapper ||
    function (_target, callback) {
      return callback;
    };

  // EventTarget.prototype.addEventListener, EventTarget.prototype.removeEventListener

  const listenerWrappersMap = new WeakMap();
  const createTypeMap = () => new Map();
  const createListenerMap = () => new WeakMap();
  const createUseCaptureMap = () => new Map();
  const createListenerWrapperBox = () => ({ value: null });

  function getOrCreateListenerWrapperBox(target, type, listener, useCapture) {
    const typeMap = getOrCreateMapEntry(
      listenerWrappersMap,
      target,
      createTypeMap
    );
    const listenerMap = getOrCreateMapEntry(typeMap, type, createListenerMap);
    const useCaptureMap = getOrCreateMapEntry(
      listenerMap,
      listener,
      createUseCaptureMap
    );
    return getOrCreateMapEntry(
      useCaptureMap,
      useCapture,
      createListenerWrapperBox
    );
  }

  function getListenerWrapperBox(target, type, listener, useCapture) {
    const targetMap = listenerWrappersMap.get(target);
    if (!targetMap) return null;
    const typeMap = targetMap.get(type);
    if (!typeMap) return null;
    const listenerMap = typeMap.get(listener);
    if (!listenerMap) return null;
    const listenerWrapperBox = listenerMap.get(useCapture);
    if (!listenerWrapperBox) return null;
    return listenerWrapperBox;
  }

  function normalizeOpts(opts) {
    if ((typeof opts === "object" && opts) || typeof opts === "function") {
      return {
        __proto__: opts,
        capture: Boolean(opts.capture),
      };
    } else {
      return Boolean(opts);
    }
  }

  function getUseCaptureByNormalizedOpts(opts) {
    return typeof opts === "object" ? opts.capture : opts;
  }

  const EventTarget_proto = EventTarget.prototype;
  const EventTarget_proto_addEventListener = EventTarget_proto.addEventListener;
  const EventTarget_proto_removeEventListener =
    EventTarget_proto.removeEventListener;

  EventTarget_proto.addEventListener = function (type, listener, opts) {
    if (typeof listener !== "function") {
      apply(EventTarget_proto_addEventListener, this, arguments);
      return;
    }
    type = String(type);
    opts = normalizeOpts(opts);
    const listenerWrapper = buildListenerWrapper(this, type, listener);
    const listenerWrapperBox = getOrCreateListenerWrapperBox(
      this,
      type,
      listener,
      getUseCaptureByNormalizedOpts(opts)
    );
    if (listenerWrapperBox.value) {
      apply(EventTarget_proto_removeEventListener, this, [
        type,
        listenerWrapperBox.value,
        opts,
      ]);
    }
    apply(EventTarget_proto_addEventListener, this, [
      type,
      listenerWrapper,
      opts,
    ]);
    listenerWrapperBox.value = listenerWrapper;
    return;
  };

  EventTarget_proto.removeEventListener = function (type, listener, opts) {
    if (typeof listener !== "function") {
      apply(EventTarget_proto_removeEventListener, this, arguments);
      return;
    }
    type = String(type);
    opts = normalizeOpts(opts);
    const listenerWrapperBox = getListenerWrapperBox(
      this,
      type,
      listener,
      getUseCaptureByNormalizedOpts(opts)
    );
    if (listenerWrapperBox && listenerWrapperBox.value) {
      apply(EventTarget_proto_removeEventListener, this, [
        type,
        listenerWrapperBox.value,
        opts,
      ]);
      listenerWrapperBox.value = null;
    }
    return;
  };

  // set Constructor.prototype.oneventname, get Constructor.prototype.oneventname

  const WRAPPEE_KEY = "$$WRAPPEE";

  function setWrappee(wrapper, wrappee) {
    const metaWrapper = function () {
      return apply(wrapper, this, arguments);
    };
    metaWrapper[WRAPPEE_KEY] = wrappee;
    return metaWrapper;
  }

  function getWrappee(wrapper) {
    // If an event handler is defined in HTML code, we cannot wrap it unless we
    // instrument that HTML code.
    return wrapper[WRAPPEE_KEY] || wrapper;
  }

  function createSetOnEventHandler(type, setter) {
    return function (listener) {
      if (typeof listener !== "function") {
        return apply(setter, this, arguments);
      }
      return apply(setter, this, [
        setWrappee(buildListenerWrapper(this, type, listener), listener),
      ]);
    };
  }

  function createGetOnEventHandler(_type, getter) {
    return function () {
      const wrapper = apply(getter, this, []);
      if (typeof wrapper !== "function") {
        return wrapper;
      }
      return getWrappee(wrapper);
    };
  }

  function wrapOnEventHandlers(target) {
    for (const key of ownKeys(target)) {
      if (typeof key !== "string") continue;
      const match = key.match(/^on([a-z]+)$/);
      if (!match) continue;
      const type = match[1];
      const d = getOwnPropertyDescriptor(target, key);
      if (!d.configurable || !d.get || !d.set) continue;
      defineProperty(target, key, {
        __proto__: d,
        get: createGetOnEventHandler(type, d.get),
        set: createSetOnEventHandler(type, d.set),
      });
    }
  }

  wrapOnEventHandlers(global);

  for (const Constructor of ownKeys(global)
    .map((key) => getOwnPropertyDescriptor(global, key).value)
    .filter(
      (value) => value && typeof value === "function" && value.prototype
    )) {
    wrapOnEventHandlers(Constructor.prototype);
  }

  // setTimeout, setInterval

  const global_setTimeout = global.setTimeout;
  const global_setInterval = global.setInterval;

  global.setTimeout = function (callback, delay, ...params) {
    return apply(global_setTimeout, this, [
      typeof callback === "function"
        ? buildCallbackWrapper(this, callback)
        : callback,
      delay,
      ...params,
    ]);
  };

  global.setInterval = function (callback, delay, ...params) {
    return apply(global_setInterval, this, [
      typeof callback === "function"
        ? buildCallbackWrapper(this, callback)
        : callback,
      delay,
      ...params,
    ]);
  };

  // Promise.prototype.then, Promise.prototype.catch, Promise.prototype.finally

  const Promise_proto = Promise.prototype;
  const Promise_proto_then = Promise_proto.then;
  const Promise_proto_catch = Promise_proto.catch;
  const Promise_proto_finally = Promise_proto.finally;

  Promise_proto.then = function (onFulfilled, onRejected) {
    return apply(Promise_proto_then, this, [
      typeof onFulfilled === "function"
        ? buildCallbackWrapper(this, onFulfilled)
        : onFulfilled,
      typeof onRejected === "function"
        ? buildCallbackWrapper(this, onRejected)
        : onRejected,
    ]);
  };

  Promise_proto.catch = function (onRejected) {
    return apply(Promise_proto_catch, this, [
      typeof onRejected === "function"
        ? buildCallbackWrapper(this, onRejected)
        : onRejected,
    ]);
  };

  Promise_proto.finally = function (onFinally) {
    return apply(Promise_proto_finally, this, [
      typeof onFinally === "function"
        ? buildCallbackWrapper(this, onFinally)
        : onFinally,
    ]);
  };

  // queueMicrotask

  const global_queueMicrotask = global.queueMicrotask;

  global.queueMicrotask = function (callback) {
    return apply(global_queueMicrotask, this, [
      typeof callback === "function"
        ? buildCallbackWrapper(this, callback)
        : callback,
    ]);
  };

  // requestAnimationFrame

  const global_requestAnimationFrame = global.requestAnimationFrame;

  global.requestAnimationFrame = function (callback) {
    return apply(global_requestAnimationFrame, this, [
      typeof callback === "function"
        ? buildCallbackWrapper(this, callback)
        : callback,
    ]);
  };
}

module.exports = wrapListeners;
