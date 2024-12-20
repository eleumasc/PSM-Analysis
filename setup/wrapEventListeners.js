"use strict";

const apply = Reflect.apply;

const EventTarget_prototype_addEventListener =
  EventTarget.prototype.addEventListener;
const EventTarget_prototype_removeEventListener =
  EventTarget.prototype.removeEventListener;

function wrapEventListeners(createListenerWrapper, isRelevantEventType) {
  const listenerWrappersMap = new WeakMap();

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
}

module.exports = wrapEventListeners;
