"use strict";

const buildTrace = require("./buildTrace");
const Array = require("./safe/Array");

const Map = require("./safe/Map");
const toSerializableValue = require("./util/toSerializableValue");

class Analysis {
  constructor() {
    this.functionCallCapturing = false;
    this.traceAcc = null;
  }

  capture() {
    this.traceAcc = {
      functionCalls: new Map(),
    };
  }

  captureEnd() {
    const traceAcc = this.traceAcc;
    if (!traceAcc) return;
    this.traceAcc = null;
    return buildTrace(traceAcc);
  }

  setFunctionCallCapturing(enabled) {
    this.functionCallCapturing = enabled;
  }

  pushFunctionCall(callId, sourceLoc, args) {
    const traceAcc = this.traceAcc;
    if (!traceAcc) return;
    if (this.functionCallCapturing) {
      traceAcc.functionCalls.set(callId, {
        sourceLoc,
        args: Array.from(args).map((arg) => toSerializableValue(arg, 1)),
      });
    }
  }

  pushFunctionReturn(callId, ret, exc) {
    const traceAcc = this.traceAcc;
    if (!traceAcc) return;
    if (this.functionCallCapturing) {
      const functionCall = traceAcc.functionCalls.get(callId);
      if (!functionCall) return;
      if (exc) {
        functionCall.exc = { e: toSerializableValue(exc.e, 1) };
      } else {
        functionCall.ret = { v: toSerializableValue(ret, 1) };
      }
    }
  }
}

module.exports = Analysis;
