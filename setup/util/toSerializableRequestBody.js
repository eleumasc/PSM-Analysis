"use strict";

const unbind = require("./unbind");

const $Array$$map = unbind(Array.prototype.map);
const $Array$$join = unbind(Array.prototype.join);
const $encodeURIComponent = global.encodeURIComponent;
const $FormData = global.FormData;
const $URLSearchParams = global.URLSearchParams;

function toSerializableRequestBody(body) {
  if (!body) {
    return "";
  } else if (typeof body === "string") {
    return body;
  } else if (body instanceof $FormData) {
    return toSearchParams(
      $Array$$map([...body], ([k, v]) => [k, toSerializableRequestBody(v)])
    );
  } else if (body instanceof $URLSearchParams) {
    return toSearchParams([...body]);
  } else {
    return "<unknown>";
  }
}

function toSearchParams(pairs) {
  return $Array$$join(
    $Array$$map(
      pairs,
      ([k, v]) => `${$encodeURIComponent(k)}=${v ? $encodeURIComponent(v) : ""}`
    ),
    "&"
  );
}

module.exports = toSerializableRequestBody;
