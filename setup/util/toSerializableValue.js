"use strict";

const Array = require("../safe/Array");

const RegExp = global.RegExp;
const String = global.String;

const getPrototypeOf = Reflect.getPrototypeOf;
const ownKeys = Reflect.ownKeys;
const getOwnPropertyDescriptor = Reflect.getOwnPropertyDescriptor;

const fromEntries = Object.fromEntries;

function toSerializableValue(value, depth, objectMap) {
  switch (typeof value) {
    case "boolean":
    case "bigint":
    case "number":
    case "string":
    case "undefined":
      return value;
    case "symbol":
      return { __type__: "symbol", description: value.description };
    case "object": {
      if (!value) {
        return value;
      } else if (value instanceof RegExp) {
        return { __type__: "regexp", pattern: String(value) };
      } else if (Array.isArray(value)) {
        if (depth > 0) {
          return value.map((element) =>
            toSerializableValue(element, depth - 1)
          );
        } else {
          return { __type__: "array", length: value.length };
        }
      } else {
        if (depth > 0) {
          return fromEntries([
            ...ownKeys(value)
              .filter((key) => typeof key === "string")
              .map((key) => [key, getOwnPropertyDescriptor(value, key)])
              .filter(([_, d]) => d && d.enumerable && !d.get && !d.set)
              .map(([key, d]) => [key, d.value])
              .map(([key, element]) => {
                return [key, toSerializableValue(element, depth - 1)];
              }),
            ["__constructor__", getConstructorName(value)],
          ]);
        } else {
          return {
            __type__: "object",
            __constructor__: getConstructorName(value),
          };
        }
      }
    }
    case "function":
      return { __type__: "function" };
    default:
      return { __type__: "unknown" };
  }
}

function getConstructorName(object) {
  const proto = getPrototypeOf(object);
  if (!proto) {
    return null;
  }
  const d = getOwnPropertyDescriptor(proto, "constructor");
  if (!d) {
    return null;
  }
  const constructor = d.value;
  if (typeof constructor !== "function") {
    return null;
  }
  return constructor.name;
}

module.exports = toSerializableValue;
