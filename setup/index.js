"use strict";

const Analysis = require("./Analysis");
const JEUFrontierBinding = require("./JEUFrontierBinding");
const wrapEventListeners = require("./wrapEventListeners");

const analysis = new Analysis({ notify: global["$$__notify"] });

const apply = Reflect.apply;
const HTMLInputElement = global.HTMLInputElement;

function createListenerWrapper(listener) {
  return function (e) {
    const target = e.target;
    if (target instanceof HTMLInputElement && target.type === "password") {
      analysis.log({ type: "input-password" });
    }
    return apply(listener, this, arguments);
  };
}

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

wrapEventListeners(createListenerWrapper, isRelevantEventType);

const observer = new MutationObserver((mutationList) => {
  analysis.log({ type: "domMutation", mutationList });
});
observer.observe(document, {
  attributes: true,
  attributeOldValue: true,
  characterData: true,
  characterDataOldValue: true,
  childList: true,
  subtree: true,
});

const binding = new JEUFrontierBinding({
  enterJEU() {
    analysis.enterJEU();
  },

  leaveJEU() {
    analysis.leaveJEU();
  },

  enter(_thisArg /* undefined */, args, loc) {
    analysis.log({ type: "functionCall", args, loc });
  },
});

global["$$__META"] = {
  __proto__: binding,

  start(loggingEnabled) {
    analysis.start(loggingEnabled);
  },
};

// global.addEventListener("load", () => {
//   analysis.start(false);
// });

console.log("setup completed");
