"use strict";

const buildTrace = require("./buildTrace");
const Array = require("./safe/Array");
const Map = require("./safe/Map");
const toSerializableValue = require("./util/toSerializableValue");

const HTMLElement = global.HTMLElement;

class Analysis {
  constructor() {
    this.functionCallCapturing = false;
    this.traceAcc = null;
  }

  capture() {
    this.traceAcc = {
      functionCalls: new Map(),
      mutations: new Array(),
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

  addFunctionEnter(callId, sourceLoc, args) {
    const traceAcc = this.traceAcc;
    if (!traceAcc) return;
    if (!this.functionCallCapturing) return;
    traceAcc.functionCalls.set(callId, {
      sourceLoc,
      args: Array.from(args).map((arg) => toSerializableValue(arg, 1)),
    });
  }

  addFunctionLeave(callId, ret, exc) {
    const traceAcc = this.traceAcc;
    if (!traceAcc) return;
    if (!this.functionCallCapturing) return;
    const functionCall = traceAcc.functionCalls.get(callId);
    if (!functionCall) return;
    if (exc) {
      functionCall.exc = { e: toSerializableValue(exc.e, 1) };
    } else {
      functionCall.ret = { v: toSerializableValue(ret, 1) };
    }
  }

  addMutationList(mutationRecords) {
    const traceAcc = this.traceAcc;
    if (!traceAcc) return;
    const mutations = Array.from(mutationRecords).map((record) => {
      const { type, target: nativeTarget } = record;
      const target = toSerializableValue(nativeTarget, 0);
      switch (type) {
        case "attributes": {
          const { attributeName, oldValue } = record;
          return {
            type,
            target,
            attributeName,
            value: nativeTarget.attributes[attributeName].value,
            oldValue,
          };
        }
        case "characterData": {
          const { oldValue } = record;
          return {
            type,
            target,
            value: nativeTarget.data,
            oldValue,
          };
        }
        case "childList": {
          const { addedNodes, removedNodes } = record;
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
    });
    for (const mutation of mutations) {
      traceAcc.mutations.push(mutation);
    }

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
}

module.exports = Analysis;
