(function (global) {
  "use strict";

  const apply = Reflect.apply;
  const log = console.log;

  const EventTarget_prototype_addEventListener =
    EventTarget.prototype.addEventListener;
  const EventTarget_prototype_removeEventListener =
    EventTarget.prototype.removeEventListener;
  const HTMLInputElement = global.HTMLInputElement;

  let loggingEnabled = false;
  let loggingTimeoutId = undefined;

  function enableLogging() {
    loggingEnabled = true;
    if (loggingTimeoutId !== undefined) {
      clearTimeout(loggingTimeoutId);
    }
    loggingTimeoutId = setTimeout(function () {
      loggingEnabled = false;
      loggingTimeoutId = undefined;
    }, 1000);
  }

  function createListenerWrapper(listener) {
    return function (e) {
      const target = e.target;
      if (target instanceof HTMLInputElement && target.type === "password") {
        enableLogging();
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

  const observer = new MutationObserver(function (mutationList) {
    if (loggingEnabled) {
      log(mutationList);
    }
  });
  observer.observe(document, {
    attributes: true,
    attributeOldValue: true,
    characterData: true,
    characterDataOldValue: true,
    childList: true,
    subtree: true,
  });

  log("setup completed");
})(this);
