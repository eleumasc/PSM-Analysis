"use strict";

const Array = require("./safe/Array");
const toSerializableValue = require("./util/toSerializableValue");

function buildTrace(traceAcc) {
  return {
    functionCalls: Array.from(traceAcc.functionCalls).map((functionCall) => {
      return {
        sourceLoc: functionCall.sourceLoc,
        args: Array.from(functionCall.args).map((arg) => {
          return toSerializableValue(arg, 1);
        }),
      };
    }),
  };
}

module.exports = buildTrace;
