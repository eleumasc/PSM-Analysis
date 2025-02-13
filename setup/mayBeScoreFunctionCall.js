"use strict";

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

function mayBeScore(serializedValue) {
  return typeof serializedValue === "number" && serializedValue % 1 === 0;
}

module.exports = mayBeScoreFunctionCall;
