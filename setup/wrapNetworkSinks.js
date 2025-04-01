"use strict";

const WeakMap = require("./safe/WeakMap");
const toSerializableRequestBody = require("./util/toSerializableRequestBody");

const $EventTarget$$addEventListener = EventTarget.prototype.addEventListener;
const $JSON$stringify = JSON.stringify;
const $Reflect$apply = Reflect.apply;
const $Request = global.Request;

function wrapNetworkSinks(callback, callbackResponse) {
  const $XMLHttpRequest$proto = XMLHttpRequest.prototype;
  const $XMLHttpRequest$proto$open = $XMLHttpRequest$proto.open;
  const $XMLHttpRequest$proto$send = $XMLHttpRequest$proto.send;

  const xhrBodyMap = new WeakMap();

  $XMLHttpRequest$proto.open = function () {
    const [method, url, ...rest] = arguments;

    const request = new $Request(url, { method });
    const requestMethod = request.method;
    const requestUrl = request.url;

    $Reflect$apply($EventTarget$$addEventListener, this, [
      "readystatechange",
      () => {
        if (this.readyState === XMLHttpRequest.DONE && this.status !== 0) {
          const body = xhrBodyMap.get(this);

          const status = this.status;
          const responseText = (() => {
            switch (this.responseType) {
              case "":
              case "text":
                return this.responseText;
              case "json":
                return $JSON$stringify(this.response);
              default:
                return "";
            }
          })();

          callbackResponse(
            {
              method: requestMethod,
              url: requestUrl,
              body,
              status,
              responseText,
            },
            this
          );
        }
      },
    ]);

    return $Reflect$apply($XMLHttpRequest$proto$open, this, [
      requestMethod,
      requestUrl,
      ...rest,
    ]);
  };

  $XMLHttpRequest$proto.send = function () {
    callback(this);

    const [body] = arguments;

    xhrBodyMap.set(this, toSerializableRequestBody(body));

    return $Reflect$apply($XMLHttpRequest$proto$send, this, arguments);
  };

  const $fetch = global.fetch;

  global.fetch = async function () {
    const [resource, init] = arguments;

    const request = new $Request(resource, init);
    callback(request);

    const method = request.method;
    const url = request.url;
    const body = await request.text();

    const response = await $Reflect$apply($fetch, this, [resource, init]);

    const responseClone = response.clone();
    const status = responseClone.status;
    const responseText = await responseClone.text();

    callbackResponse(
      {
        method,
        url,
        body,
        status,
        responseText,
      },
      request
    );

    return response;
  };
}

module.exports = wrapNetworkSinks;
