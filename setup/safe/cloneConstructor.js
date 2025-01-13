"use strict";

const apply = Reflect.apply;
const construct = Reflect.construct;
const defineProperty = Reflect.defineProperty;
const getOwnPropertyDescriptor = Reflect.getOwnPropertyDescriptor;
const ownKeys = Reflect.ownKeys;
const setPrototypeOf = Reflect.setPrototypeOf;

function cloneConstructor(Constructor) {
  // clone prototype properties
  const srcProto = Constructor.prototype;
  const dstProto = { __proto__: null };
  for (const key of ownKeys(srcProto)) {
    defineProperty(dstProto, key, getOwnPropertyDescriptor(srcProto, key));
  }

  // make safe constructor
  const clone = function () {
    if (new.target) {
      const instance = construct(Constructor, arguments);
      setPrototypeOf(instance, dstProto);
      return instance;
    } else {
      return apply(Constructor, this, arguments);
    }
  };
  clone["prototype"] = dstProto;

  // clone constructor properties
  for (const key of ownKeys(Constructor)) {
    if (key === "prototype") continue;
    defineProperty(clone, key, getOwnPropertyDescriptor(Constructor, key));
  }

  return clone;
}

module.exports = cloneConstructor;
