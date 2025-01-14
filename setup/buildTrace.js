"use strict";

function buildTrace(traceAcc) {
  return {
    functionCalls: [...traceAcc.functionCalls.values()],
    mutations: traceAcc.mutations,
  };
}

module.exports = buildTrace;
