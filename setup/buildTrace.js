"use strict";

function buildTrace(traceAcc) {
  return {
    functionCalls: [...traceAcc.functionCalls.values()],
  };
}

module.exports = buildTrace;
