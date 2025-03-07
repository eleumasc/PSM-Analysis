"use strict";

const Set = require("./safe/Set");
const getXPath = require("./getXPath");

function getMutationKeys(mutationRecords) {
  const mutationKeys = new Set();

  for (const mutationRecord of mutationRecords) {
    if (!mutationRecord.target.isConnected) continue;
    mutationKeys.add(getMutationKey(mutationRecord));
  }

  return [...mutationKeys];
}

function getMutationKey(mutationRecord) {
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

module.exports = getMutationKeys;
