"use strict";

const buildTrace = require("./buildTrace");
const Array = require("./safe/Array");
const Map = require("./safe/Map");
const toSerializableValue = require("./util/toSerializableValue");

const HTMLElement = global.HTMLElement;

class Analysis {
  constructor() {
    this.capturing = false;
    this.traceAcc = null;
  }

  capture() {
    this.traceAcc = {
      functionCalls: new Map(),
      mutations: new Array(),
      xhrRequests: new Array(),
    };
  }

  captureEnd() {
    const traceAcc = this.traceAcc;
    if (!traceAcc) return;
    this.traceAcc = null;
    return buildTrace(traceAcc);
  }

  setCapturing(enabled) {
    this.capturing = enabled;
  }

  addFunctionEnter(callId, sourceLoc, args) {
    const traceAcc = this.traceAcc;
    if (!traceAcc) return;
    if (!this.capturing) return;
    traceAcc.functionCalls.set(callId, {
      sourceLoc,
      args: Array.from(args).map((arg) => toSerializableValue(arg, 1)),
    });
  }

  addFunctionLeave(callId, ret, exc) {
    const traceAcc = this.traceAcc;
    if (!traceAcc) return;
    if (!this.capturing) return;
    const functionCall = traceAcc.functionCalls.get(callId);
    if (!functionCall) return;
    if (exc) {
      functionCall.exc = { e: toSerializableValue(exc.e, 1) };
    } else {
      functionCall.ret = { v: toSerializableValue(ret, 1) };
    }
  }

  addMutation(mutationRecord) {
    const traceAcc = this.traceAcc;
    if (!traceAcc) return;
    const mutation = (() => {
      const { type, target: nativeTarget } = mutationRecord;
      const target = toSerializableValue(nativeTarget, 0);
      switch (type) {
        case "attributes": {
          const { attributeName, oldValue } = mutationRecord;
          return {
            type,
            target,
            attributeName,
            oldValue,
          };
        }
        case "characterData": {
          const { oldValue } = mutationRecord;
          return {
            type,
            target,
            value: nativeTarget.data,
            oldValue,
          };
        }
        case "childList": {
          const { addedNodes, removedNodes } = mutationRecord;
          return {
            type,
            target,
            addedNodes: getSerializedNodes(addedNodes),
            removedNodes: getSerializedNodes(removedNodes),
            addedTexts: getNodeTexts(addedNodes),
            removedTexts: getNodeTexts(removedNodes),
          };
        }
      }
    })();
    traceAcc.mutations.push(mutation);

    function getSerializedNodes(nodes) {
      return Array.from(nodes).map((node) => toSerializableValue(node, 0));
    }

    function getNodeTexts(nodes) {
      return Array.from(nodes)
        .map((node) => {
          return node instanceof HTMLElement
            ? node.innerText
            : node.textContent;
        })
        .filter((s) => s.trim());
    }
  }

  addXHRRequest(requestRecord) {
    const traceAcc = this.traceAcc;
    if (!traceAcc) return;
    traceAcc.xhrRequests.push(requestRecord);
  }
}

module.exports = Analysis;
