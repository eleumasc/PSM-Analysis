"use strict";

const buildTrace = require("./buildTrace");
const Array = require("./safe/Array");
const Map = require("./safe/Map");
const toSerializableValue = require("./util/toSerializableValue");

class Analysis {
  constructor() {
    this.traceAcc = null;
  }

  capture(password) {
    this.traceAcc = {
      password,
      functionCalls: new Map(),
      xhrRequests: new Array(),
      mutationRecords: new Array(),
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
      args: Array.from(args).map((arg) => toSerializableValue(arg, 1)),
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
    traceAcc.mutationRecords.push(mutationRecord);
  }

  addXHRRequest(requestRecord) {
    const traceAcc = this.traceAcc;
    if (!traceAcc) return;
    traceAcc.xhrRequests.push(requestRecord);
  }
}

module.exports = Analysis;
