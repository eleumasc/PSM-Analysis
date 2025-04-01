"use strict";

const buildTrace = require("./buildTrace");
const Map = require("./safe/Map");
const toSerializableValue = require("./util/toSerializableValue");
const unbind = require("./util/unbind");

const $Array$$map = unbind(Array.prototype.map);
const $Array$$push = unbind(Array.prototype.push);

class Analysis {
  constructor() {
    this.traceAcc = null;
  }

  capture(password) {
    this.traceAcc = {
      password,
      functionCalls: new Map(),
      xhrRequests: [],
      mutationRecords: [],
    };
  }

  captureEnd() {
    const traceAcc = this.traceAcc;
    if (!traceAcc) return;
    this.traceAcc = null;
    return buildTrace(traceAcc);
  }

  addFunctionEnter(callId, sourceLoc, args) {
    const traceAcc = this.traceAcc;
    if (!traceAcc) return;
    traceAcc.functionCalls.set(callId, {
      sourceLoc,
      args: $Array$$map([...args], (arg) => toSerializableValue(arg, 1)),
    });
  }

  addFunctionLeave(callId, ret, exc) {
    const traceAcc = this.traceAcc;
    if (!traceAcc) return;
    const functionCall = traceAcc.functionCalls.get(callId);
    if (!functionCall) return;
    if (exc) {
      functionCall.exc = { e: toSerializableValue(exc.e, 1) };
    } else {
      functionCall.ret = { v: toSerializableValue(ret, 1) };
    }
  }

  addMutationRecord(mutationRecord) {
    const traceAcc = this.traceAcc;
    if (!traceAcc) return;
    $Array$$push(traceAcc.mutationRecords, mutationRecord);
  }

  addXHRRequest(requestRecord) {
    const traceAcc = this.traceAcc;
    if (!traceAcc) return;
    $Array$$push(traceAcc.xhrRequests, requestRecord);
  }
}

module.exports = Analysis;
