const $Reflect$apply = Reflect.apply;

function unbind(f) {
  return function (thisArg, ...args) {
    return $Reflect$apply(f, thisArg, args);
  };
}

module.exports = unbind;
