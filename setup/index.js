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
      analysis.addRecord({ type: "pwdFieldInput" });
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
  analysis.addRecord({ type: "domMutation", mutationList });
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
  enterJEU() {},

  leaveJEU() {},

  enter(_thisArg /* undefined */, args, loc) {
    analysis.addRecord({ type: "functionCall", args, loc });
  },
});

global["$$__META"] = {
  __proto__: binding,

  startRecording() {
    analysis.startRecording();
  },
};

console.log("setup completed");
