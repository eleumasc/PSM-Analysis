"use strict";

const getMutationKeys = require("./getMutationKeys");
const mayBeScoreFunctionCall = require("./mayBeScoreFunctionCall");
const Array = require("./safe/Array");

function buildTrace(traceAcc) {
  const { password, functionCalls, xhrRequests, mutationRecords } = traceAcc;
  return {
    functionCalls: Array.from(functionCalls.values())
      .filter((functionCall) => mayBeScoreFunctionCall(functionCall, password))
      .map(({ sourceLoc, ret }) => ({ sourceLoc, ret: ret.v })),
    xhrRequests: Array.from(xhrRequests),
    mutationKeys: getMutationKeys(Array.from(mutationRecords)),
  };
}

module.exports = buildTrace;
