"use strict";

const unbind = require("./util/unbind");

const $encodeURIComponent = global.encodeURIComponent;
const $JSON$stringify = JSON.stringify;
const $String$$includes = unbind(String.prototype.includes);

function mayBeScoreXHRRequest(xhrRequest, password) {
  const { url, body } = xhrRequest;
  return (
    $String$$includes(url, $encodeURIComponent(password)) ||
    $String$$includes(body, password) ||
    $String$$includes(body, $JSON$stringify(password)) ||
    $String$$includes(body, $encodeURIComponent(password))
  );
}

module.exports = mayBeScoreXHRRequest;
