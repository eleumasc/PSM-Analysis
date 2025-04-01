"use strict";

const mayBeScore = require("./mayBeScore");
const unbind = require("./util/unbind");

const $Array$$includes = unbind(Array.prototype.includes);
const $Array$$some = unbind(Array.prototype.some);
const $Boolean = global.Boolean;
const $Object$values = Object.values;

function mayBeScoreFunctionCall(functionCall, password) {
  const { args, ret } = functionCall;
  return (
    $Array$$includes(args, password) && $Boolean(ret) && mayIncludeScore(ret.v)
  );
}

function mayIncludeScore(serializedValue) {
  return (
    mayBeScore(serializedValue) ||
    (typeof serializedValue === "object" &&
      serializedValue &&
      serializedValue.type === "object" &&
      $Array$$some(
        $Object$values(serializedValue.value),
        (objSerializedValue) => mayBeScore(objSerializedValue)
      ))
  );
}

module.exports = mayBeScoreFunctionCall;
