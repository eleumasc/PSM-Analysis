"use strict";

const $Reflect$apply = Reflect.apply;
const $Reflect$construct = Reflect.construct;
const $Reflect$defineProperty = Reflect.defineProperty;
const $Reflect$getOwnPropertyDescriptor = Reflect.getOwnPropertyDescriptor;
const $Reflect$ownKeys = Reflect.ownKeys;
const $Reflect$setPrototypeOf = Reflect.setPrototypeOf;

function cloneConstructor(Constructor) {
  // clone prototype properties
  const srcProto = Constructor.prototype;
  const dstProto = { __proto__: null };
  for (const key of $Reflect$ownKeys(srcProto)) {
    $Reflect$defineProperty(
      dstProto,
      key,
      $Reflect$getOwnPropertyDescriptor(srcProto, key)
    );
  }

  // make safe constructor
  const clone = function () {
    if (new.target) {
      const instance = $Reflect$construct(Constructor, arguments);
      $Reflect$setPrototypeOf(instance, dstProto);
      return instance;
    } else {
      return $Reflect$apply(Constructor, this, arguments);
    }
  };
  clone["prototype"] = dstProto;

  // clone constructor properties
  for (const key of $Reflect$ownKeys(Constructor)) {
    if (key === "prototype") continue;
    $Reflect$defineProperty(
      clone,
      key,
      $Reflect$getOwnPropertyDescriptor(Constructor, key)
    );
  }

  return clone;
}

module.exports = cloneConstructor;
