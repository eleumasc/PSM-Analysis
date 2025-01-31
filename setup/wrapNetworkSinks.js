"use strict";

const WeakMap = require("./safe/WeakMap");
const toSerializableRequestBody = require("./util/toSerializableRequestBody");

const apply = Reflect.apply;
const EventTarget_proto_addEventListener =
  EventTarget.prototype.addEventListener;
const Request = global.Request;

function wrapNetworkSinks(callback, callbackResponse) {
  const XMLHttpRequest_proto = XMLHttpRequest.prototype;
  const XMLHttpRequest_proto_open = XMLHttpRequest_proto.open;
  const XMLHttpRequest_proto_send = XMLHttpRequest_proto.send;

  const xhrBodyMap = new WeakMap();

  XMLHttpRequest_proto.open = function () {
    const [method, url, ...rest] = arguments;

    const request = new Request(url, { method });
    const requestMethod = request.method;
    const requestUrl = request.url;

    apply(EventTarget_proto_addEventListener, this, [
      "readystatechange",
      () => {
        if (this.readyState === XMLHttpRequest.DONE && this.status !== 0) {
          const body = xhrBodyMap.get(this);

          const status = this.status;
          const responseText = this.responseText;

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

    return apply(XMLHttpRequest_proto_open, this, [
      requestMethod,
      requestUrl,
      ...rest,
    ]);
  };

  XMLHttpRequest_proto.send = function () {
    callback(this);

    const [body] = arguments;

    xhrBodyMap.set(this, toSerializableRequestBody(body));

    return apply(XMLHttpRequest_proto_send, this, arguments);
  };

  const global_fetch = global.fetch;

  global.fetch = async function () {
    const [request, init] = arguments;

    const effectiveRequest = init ? new Request(request, init) : request;

    callback(effectiveRequest);

    const requestClone = effectiveRequest.clone();
    const method = requestClone.method;
    const url = requestClone.url;
    const body = await requestClone.text();

    const response = await apply(global_fetch, this, [effectiveRequest]);

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
      effectiveRequest
    );

    return response;
  };
}

module.exports = wrapNetworkSinks;
