const defineProperty = Reflect.defineProperty;

const VIRTUAL_INTEGRITY_KEY = Symbol();

function preventIntegrityCheck() {
  const HTMLScriptElement_proto = HTMLScriptElement.prototype;

  defineProperty(HTMLScriptElement_proto, "integrity", {
    enumerable: true,
    configurable: true,
    get: function () {
      return this[VIRTUAL_INTEGRITY_KEY] || "";
    },
    set: function (value) {
      this[VIRTUAL_INTEGRITY_KEY] = value;
    },
  });
}

preventIntegrityCheck.VIRTUAL_INTEGRITY_KEY = VIRTUAL_INTEGRITY_KEY;

module.exports = preventIntegrityCheck;
