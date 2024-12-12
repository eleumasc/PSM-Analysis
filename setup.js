(function (global) {
  "use strict";

  const ownKeys = Reflect.ownKeys;
  const getOwnPropertyDescriptor = Reflect.getOwnPropertyDescriptor;
  const defineProperty = Reflect.defineProperty;
  const apply = Reflect.apply;

  const EventTarget_prototype_addEventListener =
    EventTarget.prototype.addEventListener;
  const EventTarget_prototype_removeEventListener =
    EventTarget.prototype.removeEventListener;
  const Node = global.Node;
  const HTMLInputElement = global.HTMLInputElement;

  let loggingEnabled = false; // TODO: rewrite code to manage yield and await

  function createListenerWrapper(listener) {
    return function (e) {
      const target = e.target;
      if (target instanceof HTMLInputElement && target.type === "password") {
        loggingEnabled = true;
        try {
          return apply(listener, this, arguments);
        } finally {
          loggingEnabled = false;
        }
      }

      return apply(listener, this, arguments);
    };
  }

  const listenerWrappersMap = new WeakMap();

  function isRelevantEventType(type) {
    switch (type) {
      case "change":
      case "input":
      case "keydown":
      case "keypress":
      case "keyup":
        return true;
      default:
        return false;
    }
  }

  function addEventListener() {
    const [type, listener, ...restArgs] = arguments;
    if (
      listener &&
      typeof listener === "function" &&
      isRelevantEventType(type)
    ) {
      let listenerWrapper = listenerWrappersMap.get(listener);
      if (!listenerWrapper) {
        listenerWrapper = createListenerWrapper(listener);
        listenerWrappersMap.set(listener, listenerWrapper);
      }
      return apply(EventTarget_prototype_addEventListener, this, [
        type,
        listenerWrapper,
        ...restArgs,
      ]);
    }
    return apply(EventTarget_prototype_addEventListener, this, arguments);
  }

  function removeEventListener() {
    const [type, listener, ...restArgs] = arguments;
    return apply(EventTarget_prototype_removeEventListener, this, [
      type,
      listenerWrappersMap.get(listener) || listener,
      ...restArgs,
    ]);
  }

  EventTarget.prototype.addEventListener = addEventListener;
  EventTarget.prototype.removeEventListener = removeEventListener;

  function createNodeFunctionWrapper(f) {
    return function () {
      if (loggingEnabled) {
        console.log(f.name, this.constructor.name, this, arguments);
      }
      return apply(f, this, arguments);
    };
  }

  function getNodeConstructors(global) {
    return ownKeys(global)
      .map((k) => getOwnPropertyDescriptor(global, k).value)
      .filter(
        (v) => v && typeof v === "function" && v.prototype instanceof Node
      );
  }

  for (const C of getNodeConstructors(global)) {
    const proto = C.prototype;
    for (const k of ownKeys(proto)) {
      const d = getOwnPropertyDescriptor(proto, k);
      if (!d.configurable) continue;
      if (typeof d.value === "function") {
        if (!d.value.prototype) {
          defineProperty(proto, k, {
            __proto__: d,
            value: createNodeFunctionWrapper(d.value),
          });
        }
      } else if (typeof d.set === "function") {
        defineProperty(proto, k, {
          __proto__: d,
          set: createNodeFunctionWrapper(d.set),
        });
      }
    }
  }
})(this);
