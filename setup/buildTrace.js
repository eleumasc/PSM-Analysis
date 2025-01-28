"use strict";

function buildTrace(traceAcc) {
  return {
    // functionCalls: [...traceAcc.functionCalls.values()], // TODO: uncomment and make payload more lightweight
    functionCalls: [],
    mutations: [...traceAcc.mutations],
    xhrRequests: [...traceAcc.xhrRequests],
  };
}

module.exports = buildTrace;
