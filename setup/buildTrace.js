"use strict";

const getMutationKeys = require("./getMutationKeys");
const mayBeScoreFunctionCall = require("./mayBeScoreFunctionCall");
const mayBeScoreXHRRequest = require("./mayBeScoreXHRRequest");
const unbind = require("./util/unbind");

const $Array$$filter = unbind(Array.prototype.filter);
const $Array$$map = unbind(Array.prototype.map);

function buildTrace(traceAcc) {
  const { password, functionCalls, xhrRequests, mutationRecords } = traceAcc;
  return {
    functionCalls: $Array$$map(
      $Array$$filter([...functionCalls.values()], (functionCall) =>
        mayBeScoreFunctionCall(functionCall, password)
      ),
      ({ sourceLoc, ret }) => ({ sourceLoc, ret: ret.v })
    ),
    xhrRequests: $Array$$filter([...xhrRequests], (xhrRequest) =>
      mayBeScoreXHRRequest(xhrRequest, password)
    ),
    mutationKeys: getMutationKeys([...mutationRecords]),
  };
}

module.exports = buildTrace;
