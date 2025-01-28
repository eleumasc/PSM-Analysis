"use strict";

const encodeURIComponent = global.encodeURIComponent;
const FormData = global.FormData;
const URLSearchParams = global.URLSearchParams;

function toSerializableRequestBody(body) {
  if (!body) {
    return "";
  } else if (typeof body === "string") {
    return body;
  } else if (body instanceof FormData) {
    return toSearchParams(
      [...body].map(([k, v]) => [k, toSerializableRequestBody(v)])
    );
  } else if (body instanceof URLSearchParams) {
    return toSearchParams([...body]);
  } else {
    return "UnKnOwN";
  }
}

function toSearchParams(pairs) {
  return pairs
    .map(
      ([k, v]) => `${encodeURIComponent(k)}=${v ? encodeURIComponent(v) : ""}`
    )
    .join("&");
}

module.exports = toSerializableRequestBody;
