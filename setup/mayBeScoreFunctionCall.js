"use strict";

const mayBeScore = require("./mayBeScore");

const Boolean = global.Boolean;
const Object_values = Object.values;

function mayBeScoreFunctionCall(functionCall, password) {
  const { args, ret } = functionCall;
  return args.includes(password) && Boolean(ret) && mayIncludeScore(ret.v);
}

function mayIncludeScore(serializedValue) {
  return (
    mayBeScore(serializedValue) ||
    (typeof serializedValue === "object" &&
      serializedValue &&
      serializedValue.type === "object" &&
      Object_values(serializedValue.value).some((objSerializedValue) =>
        mayBeScore(objSerializedValue)
      ))
  );
}

module.exports = mayBeScoreFunctionCall;
