// "use strict";

const getOrCreateMapEntry = require("./util/getOrCreateMapEntry");
const Map = require("./safe/Map");
const WeakMap = require("./safe/WeakMap");
const unbind = require("./util/unbind");

const $Array$$map = unbind(Array.prototype.map);
const $Array$$filter = unbind(Array.prototype.filter);
const $Boolean = global.Boolean;
const $Reflect$apply = Reflect.apply;
const $Reflect$defineProperty = Reflect.defineProperty;
const $Reflect$getOwnPropertyDescriptor = Reflect.getOwnPropertyDescriptor;
const $Reflect$ownKeys = Reflect.ownKeys;
const $String = global.String;
const $String$$match = unbind(String.prototype.match);

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
        capture: $Boolean(opts.capture),
      };
    } else {
      return $Boolean(opts);
    }
  }

  function getUseCaptureByNormalizedOpts(opts) {
    return typeof opts === "object" ? opts.capture : opts;
  }

  function isListenerCallback(value) {
    return (
      typeof value === "function" ||
      (value &&
        typeof value === "object" &&
        typeof value.handleEvent === "function")
    );
  }

  const $EventTarget$proto = EventTarget.prototype;
  const $EventTarget$proto$addEventListener = $EventTarget$proto.addEventListener;
  const $EventTarget$proto$removeEventListener =
    $EventTarget$proto.removeEventListener;

  $EventTarget$proto.addEventListener = function (type, listener, opts) {
    if (!isListenerCallback(listener)) {
      $Reflect$apply($EventTarget$proto$addEventListener, this, arguments);
      return;
    }
    type = $String(type);
    opts = normalizeOpts(opts);
    const listenerWrapper = buildListenerWrapper(
      this,
      type,
      typeof listener === "function"
        ? listener
        : function () {
            return $Reflect$apply(listener.handleEvent, listener, arguments);
          }
    );
    const listenerWrapperBox = getOrCreateListenerWrapperBox(
      this,
      type,
      listener,
      getUseCaptureByNormalizedOpts(opts)
    );
    if (listenerWrapperBox.value) {
      $Reflect$apply($EventTarget$proto$removeEventListener, this, [
        type,
        listenerWrapperBox.value,
        opts,
      ]);
    }
    $Reflect$apply($EventTarget$proto$addEventListener, this, [
      type,
      listenerWrapper,
      opts,
    ]);
    listenerWrapperBox.value = listenerWrapper;
    return;
  };

  $EventTarget$proto.removeEventListener = function (type, listener, opts) {
    if (!isListenerCallback(listener)) {
      $Reflect$apply($EventTarget$proto$removeEventListener, this, arguments);
      return;
    }
    type = $String(type);
    opts = normalizeOpts(opts);
    const listenerWrapperBox = getListenerWrapperBox(
      this,
      type,
      listener,
      getUseCaptureByNormalizedOpts(opts)
    );
    if (listenerWrapperBox && listenerWrapperBox.value) {
      $Reflect$apply($EventTarget$proto$removeEventListener, this, [
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
      return $Reflect$apply(wrapper, this, arguments);
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
        return $Reflect$apply(setter, this, arguments);
      }
      return $Reflect$apply(setter, this, [
        setWrappee(buildListenerWrapper(this, type, listener), listener),
      ]);
    };
  }

  function createGetOnEventHandler(_type, getter) {
    return function () {
      const wrapper = $Reflect$apply(getter, this, []);
      if (typeof wrapper !== "function") {
        return wrapper;
      }
      return getWrappee(wrapper);
    };
  }

  function wrapOnEventHandlers(target) {
    for (const key of $Reflect$ownKeys(target)) {
      if (typeof key !== "string") continue;
      const match = $String$$match(key, /^on([a-z]+)$/);
      if (!match) continue;
      const type = match[1];
      const d = $Reflect$getOwnPropertyDescriptor(target, key);
      if (!d.configurable || !d.get || !d.set) continue;
      $Reflect$defineProperty(target, key, {
        __proto__: d,
        get: createGetOnEventHandler(type, d.get),
        set: createSetOnEventHandler(type, d.set),
      });
    }
  }

  wrapOnEventHandlers(global);

  for (const Constructor of $Array$$filter(
    $Array$$map(
      $Reflect$ownKeys(global),
      (key) => $Reflect$getOwnPropertyDescriptor(global, key).value
    ),
    (value) => value && typeof value === "function" && value.prototype
  )) {
    wrapOnEventHandlers(Constructor.prototype);
  }

  // setTimeout, setInterval

  const $setTimeout = global.setTimeout;
  const $setInterval = global.setInterval;

  global.setTimeout = function (callback, delay, ...params) {
    return $Reflect$apply($setTimeout, this, [
      typeof callback === "function"
        ? buildCallbackWrapper(this, callback)
        : callback,
      delay,
      ...params,
    ]);
  };

  global.setInterval = function (callback, delay, ...params) {
    return $Reflect$apply($setInterval, this, [
      typeof callback === "function"
        ? buildCallbackWrapper(this, callback)
        : callback,
      delay,
      ...params,
    ]);
  };

  // Promise.prototype.then, Promise.prototype.catch, Promise.prototype.finally

  const $Promise$proto = Promise.prototype;
  const $Promise$proto$then = $Promise$proto.then;
  const $Promise$proto$catch = $Promise$proto.catch;
  const $Promise$proto$finally = $Promise$proto.finally;

  $Promise$proto.then = function (onFulfilled, onRejected) {
    return $Reflect$apply($Promise$proto$then, this, [
      typeof onFulfilled === "function"
        ? buildCallbackWrapper(this, onFulfilled)
        : onFulfilled,
      typeof onRejected === "function"
        ? buildCallbackWrapper(this, onRejected)
        : onRejected,
    ]);
  };

  $Promise$proto.catch = function (onRejected) {
    return $Reflect$apply($Promise$proto$catch, this, [
      typeof onRejected === "function"
        ? buildCallbackWrapper(this, onRejected)
        : onRejected,
    ]);
  };

  $Promise$proto.finally = function (onFinally) {
    return $Reflect$apply($Promise$proto$finally, this, [
      typeof onFinally === "function"
        ? buildCallbackWrapper(this, onFinally)
        : onFinally,
    ]);
  };

  // queueMicrotask

  const $queueMicrotask = global.queueMicrotask;

  global.queueMicrotask = function (callback) {
    return $Reflect$apply($queueMicrotask, this, [
      typeof callback === "function"
        ? buildCallbackWrapper(this, callback)
        : callback,
    ]);
  };

  // requestAnimationFrame

  const $requestAnimationFrame = global.requestAnimationFrame;

  global.requestAnimationFrame = function (callback) {
    return $Reflect$apply($requestAnimationFrame, this, [
      typeof callback === "function"
        ? buildCallbackWrapper(this, callback)
        : callback,
    ]);
  };
}

module.exports = wrapListeners;
