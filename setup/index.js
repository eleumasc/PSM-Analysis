"use strict";

const Analysis = require("./Analysis");
const JobTracker = require("./JobTracker");
const preventIntegrityCheck = require("./preventIntegrityCheck");
const Set = require("./safe/Set");
const WeakMap = require("./safe/WeakMap");
const wrapListeners = require("./wrapListeners");
const wrapNetworkSinks = require("./wrapNetworkSinks");
const wrapPostMessage = require("./wrapPostMessage");

const $Reflect$apply = Reflect.apply;
const $HTMLInputElement = global.HTMLInputElement;

function isPasswordFieldInputEvent(e) {
  const target = e.target;
  if (target instanceof $HTMLInputElement && target.type === "password") {
    switch (e.type) {
      case "input":
      case "keyup":
      case "change":
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

const relevantJobs = new Set();
let isRunningJobRelevant = false;

const jobTracker = new JobTracker({
  jobStart(_jobId, parentJobId) {
    if (parentJobId && relevantJobs.has(parentJobId)) {
      relevantJobs.add(jobTracker.jobId);
      isRunningJobRelevant = true;
      mutObs?.takeRecords(); // reset the mutation queue
    }
  },

  jobEnd(_jobId) {
    if (isRunningJobRelevant) {
      const mutationList = mutObs?.takeRecords();
      if (mutationList) {
        for (const mutationRecord of mutationList) {
          analysis.addMutationRecord(mutationRecord);
        }
      }
      isRunningJobRelevant = false;
    }
  },
});

let nextCallId = 1;

global["$$ADVICE"] = {
  __proto__: jobTracker.createAdvice(),

  enter(sourceLoc, args) {
    super.enter();
    const callId = nextCallId++;
    if (isRunningJobRelevant) {
      analysis.addFunctionEnter(callId, sourceLoc, args);
    }
    return callId;
  },

  leave(callId, ret, exc) {
    if (isRunningJobRelevant) {
      analysis.addFunctionLeave(callId, ret, exc);
    }
    super.leave();
  },

  capture(password) {
    analysis.capture(password);
  },

  captureEnd() {
    return analysis.captureEnd();
  },
};

const networkSinkJobIdMap = new WeakMap();

wrapNetworkSinks(
  function callback(request) {
    networkSinkJobIdMap.set(request, jobTracker.jobId);
  },
  function callbackResponse(requestRecord, request) {
    if (relevantJobs.has(networkSinkJobIdMap.get(request))) {
      analysis.addXHRRequest(requestRecord);
    }
  }
);

wrapPostMessage(function callbackMeta() {
  return { jobId: jobTracker.jobId };
});

function isRelevantMessageEvent(e) {
  return e.type === "message" && e.meta && relevantJobs.has(e.meta.jobId);
}

wrapListeners(
  function buildListenerWrapper(_target, _type, listener) {
    const setterJobId = jobTracker.jobId;
    return function (e) {
      jobTracker.enter(setterJobId);
      if (isPasswordFieldInputEvent(e) || isRelevantMessageEvent(e)) {
        relevantJobs.add(jobTracker.jobId);
        isRunningJobRelevant = true;
        mutObs?.takeRecords(); // reset the mutation queue
      }
      try {
        return $Reflect$apply(listener, this, arguments);
      } finally {
        jobTracker.leave();
      }
    };
  },
  function buildCallbackWrapper(_target, callback) {
    const setterJobId = jobTracker.jobId;
    return function () {
      jobTracker.enter(setterJobId);
      try {
        return $Reflect$apply(callback, this, arguments);
      } finally {
        jobTracker.leave();
      }
    };
  }
);

preventIntegrityCheck();

console.log("setup completed");
