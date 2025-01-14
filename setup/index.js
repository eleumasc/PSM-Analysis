"use strict";

const Analysis = require("./Analysis");
const CallFlowTracker = require("./CallFlowTracker");
const Set = require("./safe/Set");
const wrapListeners = require("./wrapListeners");

const apply = Reflect.apply;
const HTMLInputElement = global.HTMLInputElement;

function isPasswordFieldInputEvent(e) {
  const target = e.target;
  if (target instanceof HTMLInputElement && target.type === "password") {
    switch (e.type) {
      case "change":
      case "input":
      case "keydown":
      case "keypress":
      case "keyup":
        return true;
      default:
        return false;
    }
  } else {
    return false;
  }
}

const analysis = new Analysis();

document.addEventListener("DOMContentLoaded", () => {
  const mutObs = new MutationObserver((mutationList) => {
    analysis.addMutationList(mutationList);
  });

  mutObs.observe(document.body, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeOldValue: true,
    characterData: true,
    characterDataOldValue: true,
  });
});

const relevantFlows = new Set();

const callFlowTracker = new CallFlowTracker({
  flowStart(flowId) {
    if (relevantFlows.has(flowId)) {
      analysis.setFunctionCallCapturing(true);
    }
  },

  flowEnd(_flowId) {
    analysis.setFunctionCallCapturing(false);
  },

  flowContinue(flowId) {
    if (relevantFlows.has(flowId)) {
      analysis.setFunctionCallCapturing(true);
    }
  },
});

let nextCallId = 1;

global["$$ADVICE"] = {
  __proto__: callFlowTracker.createAdvice(),

  enter(sourceLoc, args) {
    super.enter();
    const callId = nextCallId++;
    analysis.addFunctionEnter(callId, sourceLoc, args);
    return callId;
  },

  leave(callId, ret, exc) {
    super.leave();
    analysis.addFunctionLeave(callId, ret, exc);
  },

  capture() {
    analysis.capture();
  },

  captureEnd() {
    return analysis.captureEnd();
  },
};

wrapListeners(
  global,
  function buildListenerWrapper(_target, _type, listener) {
    const setterFlowId = callFlowTracker.flowId;
    return function (e) {
      if (isPasswordFieldInputEvent(e)) {
        relevantFlows.add(callFlowTracker.requestNextFlowId());
        callFlowTracker.enter();
      } else {
        callFlowTracker.continue(setterFlowId);
      }
      try {
        return apply(listener, this, arguments);
      } finally {
        callFlowTracker.leave();
      }
    };
  },
  function buildCallbackWrapper(_target, callback) {
    const setterFlowId = callFlowTracker.flowId;
    return function () {
      callFlowTracker.continue(setterFlowId);
      try {
        return apply(callback, this, arguments);
      } finally {
        callFlowTracker.leave();
      }
    };
  }
);

console.log("setup completed");
