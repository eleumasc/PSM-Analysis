"use strict";

const Analysis = require("./Analysis");
const CallFlowTracker = require("./CallFlowTracker");
const preventIntegrityCheck = require("./preventIntegrityCheck");
const Set = require("./safe/Set");
const WeakMap = require("./safe/WeakMap");
const wrapListeners = require("./wrapListeners");
const wrapNetworkSinks = require("./wrapNetworkSinks");
const wrapPostMessage = require("./wrapPostMessage");

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
      case "blur":
      case "focusout":
        return true;
      default:
        return false;
    }
  } else {
    return false;
  }
}

const analysis = new Analysis();

let mutObs;
document.addEventListener("DOMContentLoaded", () => {
  mutObs = new MutationObserver(() => {});

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
      mutObs?.takeRecords(); // reset the mutation queue
      analysis.setCapturing(true);
    }
  },

  flowEnd(flowId) {
    if (relevantFlows.has(flowId)) {
      const mutationList = mutObs?.takeRecords();
      if (mutationList) {
        for (const mutationRecord of mutationList) {
          analysis.addMutation(mutationRecord);
        }
      }
    }
    analysis.setCapturing(false);
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
    analysis.addFunctionLeave(callId, ret, exc);
    super.leave();
  },

  capture() {
    analysis.capture();
  },

  captureEnd() {
    return analysis.captureEnd();
  },
};

const networkSinkFlowIdMap = new WeakMap();

wrapNetworkSinks(
  function callback(request) {
    networkSinkFlowIdMap.set(request, callFlowTracker.flowId);
  },
  function callbackResponse(requestRecord, request) {
    if (relevantFlows.has(networkSinkFlowIdMap.get(request))) {
      analysis.addXHRRequest(requestRecord);
    }
  }
);

wrapPostMessage(function callbackMeta() {
  return { flowId: callFlowTracker.flowId };
});

function isRelevantMessageEvent(e) {
  return e.type === "message" && e.meta && relevantFlows.has(e.meta.flowId);
}

wrapListeners(
  function buildListenerWrapper(_target, _type, listener) {
    const setterFlowId = callFlowTracker.flowId;
    return function (e) {
      if (isPasswordFieldInputEvent(e) || isRelevantMessageEvent(e)) {
        callFlowTracker.enter();
        relevantFlows.add(callFlowTracker.flowId);
        mutObs?.takeRecords(); // reset the mutation queue
        analysis.setCapturing(true);
      } else {
        callFlowTracker.defer(setterFlowId);
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
      callFlowTracker.defer(setterFlowId);
      try {
        return apply(callback, this, arguments);
      } finally {
        callFlowTracker.leave();
      }
    };
  }
);

preventIntegrityCheck();

console.log("setup completed");
