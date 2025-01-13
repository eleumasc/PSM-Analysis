"use strict";

const Array = require("../safe/Array");
const WeakMap = require("../safe/WeakMap");
const getOrCreateMapEntry = require("./getOrCreateMapEntry");

const RegExp = global.RegExp;
const String = global.String;

const getPrototypeOf = Reflect.getPrototypeOf;
const ownKeys = Reflect.ownKeys;
const getOwnPropertyDescriptor = Reflect.getOwnPropertyDescriptor;
const fromEntries = Object.fromEntries;

const objectMap = new WeakMap();
let nextObjectId = 1;

function toSerializableValue(value, depth) {
  switch (typeof value) {
    case "boolean":
    case "bigint":
    case "number":
    case "string":
    case "undefined":
      return value;
    case "symbol":
      return { type: "symbol", description: value.description };
    case "object": {
      if (!value) {
        return value;
      } else if (value instanceof RegExp) {
        return { type: "RegExp", pattern: String(value) };
      } else if (Array.isArray(value)) {
        return {
          type: "Array",
          id: getObjectId(value),
          value:
            depth > 0
              ? value.map((element) => toSerializableValue(element, depth - 1))
              : null,
        };
      } else {
        const constructorName = getConstructorName(value);
        return {
          type: "object",
          id: getObjectId(value),
          constructor: constructorName !== "Object" ? constructorName : null,
          value:
            depth > 0
              ? fromEntries(
                  ownKeys(value)
                    .filter((key) => typeof key === "string")
                    .map((key) => [key, getOwnPropertyDescriptor(value, key)])
                    .filter(([_, d]) => d && d.enumerable && !d.get && !d.set)
                    .map(([key, d]) => [key, d.value])
                    .map(([key, element]) => {
                      return [key, toSerializableValue(element, depth - 1)];
                    })
                )
              : null,
        };
      }
    }
    case "function":
      return {
        type: "function",
        id: getObjectId(value),
      };
    default:
      throw new Error(); // this should never happen
  }
}

function getObjectId(object) {
  return getOrCreateMapEntry(objectMap, object, () => nextObjectId++);
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
