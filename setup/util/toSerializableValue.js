"use strict";

const WeakMap = require("../safe/WeakMap");
const getOrCreateMapEntry = require("./getOrCreateMapEntry");
const unbind = require("./unbind");

const $Array$isArray = Array.isArray;
const $Array$$filter = unbind(Array.prototype.filter);
const $Array$$map = unbind(Array.prototype.map);
const Object$fromEntries = Object.fromEntries;
const $Reflect$getPrototypeOf = Reflect.getPrototypeOf;
const $Reflect$ownKeys = Reflect.ownKeys;
const $Reflect$getOwnPropertyDescriptor = Reflect.getOwnPropertyDescriptor;
const $RegExp = global.RegExp;
const $String = global.String;

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
      } else if (value instanceof $RegExp) {
        return { type: "RegExp", pattern: $String(value) };
      } else if ($Array$isArray(value)) {
        return {
          type: "Array",
          id: getObjectId(value),
          value:
            depth > 0
              ? $Array$$map(value, (element) =>
                  toSerializableValue(element, depth - 1)
                )
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
              ? Object$fromEntries(
                  (() => {
                    let t;
                    t = $Reflect$ownKeys(value);
                    t = $Array$$filter(t, (key) => typeof key === "string");
                    t = $Array$$map(t, (key) => [
                      key,
                      $Reflect$getOwnPropertyDescriptor(value, key),
                    ]);
                    t = $Array$$filter(
                      t,
                      ([_, d]) => d && d.enumerable && !d.get && !d.set
                    );
                    t = $Array$$map(t, ([key, d]) => [key, d.value]);
                    t = $Array$$map(t, ([key, element]) => {
                      return [key, toSerializableValue(element, depth - 1)];
                    });
                    return t;
                  })()
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
      throw 0; // this should never happen
  }
}

function getObjectId(object) {
  return getOrCreateMapEntry(objectMap, object, () => nextObjectId++);
}

function getConstructorName(object) {
  const proto = $Reflect$getPrototypeOf(object);
  if (!proto) {
    return null;
  }
  const d = $Reflect$getOwnPropertyDescriptor(proto, "constructor");
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
