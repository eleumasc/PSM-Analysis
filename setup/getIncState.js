"use strict";

const Map = require("./safe/Map");
const getXPath = require("./getXPath");
const murmurHash3 = require("./util/murmurHash3js");

const CHILDLIST_INC_STATE_VALUE_MAX_LENGTH = 16 * 1024;

function getIncState(mutationRecords) {
  const stateMap = new Map();

  for (const mutationRecord of mutationRecords) {
    if (!mutationRecord.target.isConnected) continue;
    const stateKey = getIncStateKey(mutationRecord);
    if (stateMap.has(stateKey)) continue;
    stateMap.set(stateKey, getIncStateValue(mutationRecord));
  }

  return [...stateMap].map(([key, value]) => ({ key, value }));
}

function getIncStateKey(mutationRecord) {
  const { type, target } = mutationRecord;
  const targetPath = getXPath(target);
  switch (type) {
    case "attributes": {
      const { attributeName } = mutationRecord;
      return `${type}:${targetPath}:${attributeName}`;
    }
    case "characterData":
      return `${type}:${targetPath}`;
    case "childList":
      return `${type}:${targetPath}`;
  }
}

function getIncStateValue(mutationRecord) {
  const { type, target } = mutationRecord;
  switch (type) {
    case "attributes": {
      const { attributeName } = mutationRecord;
      return target.attributes[attributeName]?.value ?? null;
    }
    case "characterData":
      return target.textContent;
    case "childList": {
      const value = target.innerHTML;
      if (value.length >= CHILDLIST_INC_STATE_VALUE_MAX_LENGTH) {
        return `Murmur3:${murmurHash3.x64.hash128(value)}`;
      }
      return value;
    }
  }
}

module.exports = getIncState;
