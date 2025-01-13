"use strict";

const buildTrace = require("./buildTrace");

const Array = require("./safe/Array");

class Analysis {
  constructor() {
    this.functionCallCapturing = false;
    this.traceAcc = null;
  }

  capture() {
    this.traceAcc = {
      functionCalls: new Array(),
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

  pushFunctionCall(sourceLoc, args) {
    const traceAcc = this.traceAcc;
    if (!traceAcc) return;
    if (this.functionCallCapturing) {
      traceAcc.functionCalls.push({ sourceLoc, args });
    }
  }
}

module.exports = Analysis;
