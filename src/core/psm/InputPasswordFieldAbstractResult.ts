import _ from "lodash";
import assert from "assert";
import canParseJSON from "../../util/canParseJSON";
import mayBeScore from "./mayBeScore";
import {
  Trace,
  FunctionCall,
  InputPasswordFieldResult,
  SourceLoc,
  XHRRequest,
  MutationKey,
} from "../InputPasswordFieldResult";

export type InputPasswordFieldAbstractResult =
  InputPasswordFieldAbstractDetail[];

export type InputPasswordFieldAbstractDetail = {
  password: string;
  abstractTraces: AbstractTrace[];
};

export type CapturePhase = "fill" | "blur";

export type AbstractTrace = {
  capturePhase: CapturePhase;
  abstractCalls: AbstractCall[];
  mutationKeys: MutationKey[];
};

export type AbstractCall = {
  type: AbstractCallType;
  value: number;
};

export interface BaseAbstractCallType {
  kind: string;
}

export interface FunctionCallAbstractCallType extends BaseAbstractCallType {
  kind: "functionCall";
  sourceLoc: SourceLoc;
  propertyName?: string;
}

export interface XHRRequestAbstractCallType extends BaseAbstractCallType {
  kind: "xhrRequest";
  url: string;
  propertyName?: string;
}

export type AbstractCallType =
  | FunctionCallAbstractCallType
  | XHRRequestAbstractCallType;

export function getIPFAbstractResultFromIPFResult(
  ipfResult: InputPasswordFieldResult
): InputPasswordFieldAbstractResult {
  return ipfResult.map(
    ({ password, fillTrace, blurTrace }): InputPasswordFieldAbstractDetail => {
      const createAbstractTraceArray = (
        traceArray: (Trace | undefined)[],
        capturePhase: CapturePhase
      ): AbstractTrace[] =>
        traceArray
          .filter((x): x is NonNullable<typeof x> => Boolean(x))
          .map((trace): Trace => {
            const { functionCalls, xhrRequests, mutationKeys } = trace;
            return {
              functionCalls,
              xhrRequests: xhrRequests.filter((xhrRequest) => {
                const { url, body } = xhrRequest;
                return (
                  url.includes(encodeURIComponent(password)) ||
                  body.includes(password) ||
                  body.includes(JSON.stringify(password)) ||
                  body.includes(encodeURIComponent(password))
                );
              }),
              mutationKeys,
            };
          })
          .map(
            (trace): AbstractTrace =>
              getAbstractTraceFromTrace(trace, capturePhase)
          );
      return {
        password,
        abstractTraces: [
          ...createAbstractTraceArray([fillTrace], "fill"),
          ...createAbstractTraceArray([blurTrace], "blur"),
        ],
      };
    }
  );
}

function getAbstractTraceFromTrace(
  trace: Trace,
  capturePhase: CapturePhase
): AbstractTrace {
  const { functionCalls, xhrRequests, mutationKeys } = trace;
  return {
    capturePhase,
    abstractCalls: filterDistinctAndConsistentAbstractCalls([
      ...functionCalls.flatMap((functionCall) =>
        getAbstractCallsFromFunctionCall(functionCall)
      ),
      ...xhrRequests.flatMap((xhrRequest) =>
        getAbstractCallsFromXHRRequest(xhrRequest)
      ),
    ]),
    mutationKeys,
  };
}

export function getAbstractCallsFromFunctionCall(
  functionCall: FunctionCall
): (AbstractCall & { type: FunctionCallAbstractCallType })[] {
  const { sourceLoc, ret } = functionCall;
  if (mayBeScore(ret)) {
    return [
      {
        type: { kind: "functionCall", sourceLoc },
        value: ret,
      },
    ];
  } else if (
    typeof ret === "object" &&
    ret &&
    ret.type === "object" &&
    ret.constructor === null
  ) {
    assert(ret.value);
    const obj = ret.value;
    return Reflect.ownKeys(obj).flatMap((objKey) => {
      assert(typeof objKey === "string");
      const objValue = obj[objKey];
      return mayBeScore(objValue)
        ? [
            {
              type: { kind: "functionCall", sourceLoc, propertyName: objKey },
              value: objValue,
            },
          ]
        : [];
    });
  } else {
    return [];
  }
}

export function getAbstractCallsFromXHRRequest(
  xhrRequest: XHRRequest
): (AbstractCall & { type: XHRRequestAbstractCallType })[] {
  const { url: rawUrl, responseText } = xhrRequest;
  const cookedUrl = new URL(rawUrl);
  const url = `${cookedUrl.origin}${cookedUrl.pathname}`;
  const response = canParseJSON(responseText)
    ? JSON.parse(responseText)
    : responseText;
  if (mayBeScore(response)) {
    return [
      {
        type: { kind: "xhrRequest", url },
        value: response,
      },
    ];
  } else if (typeof response === "object" && response) {
    const obj = response;
    return Reflect.ownKeys(obj).flatMap((objKey) => {
      assert(typeof objKey === "string");
      const objValue = obj[objKey];
      return mayBeScore(objValue)
        ? [
            {
              type: { kind: "xhrRequest", url, propertyName: objKey },
              value: objValue,
            },
          ]
        : [];
    });
  } else {
    return [];
  }
}

function filterDistinctAndConsistentAbstractCalls(
  abstractCalls: AbstractCall[]
): AbstractCall[] {
  const grouped = _.groupBy(abstractCalls, (abstractCall) =>
    getAbstractCallTypeKey(abstractCall.type)
  );
  return Object.values(grouped).flatMap((group) => {
    const uniqueRets = _.uniqWith(group, (a, b) => _.isEqual(a.value, b.value));
    return uniqueRets.length === 1 ? uniqueRets : [];
  });
}

export function getAbstractCallTypeKey(type: AbstractCallType): string {
  const { kind } = type;
  switch (kind) {
    case "functionCall": {
      const { sourceLoc, propertyName } = type;
      return `${kind}:${JSON.stringify(sourceLoc)}:${propertyName ?? ""}`;
    }
    case "xhrRequest": {
      const { url, propertyName } = type;
      return `${kind}:${url}:${propertyName ?? ""}`;
    }
    default:
      throw new Error(); // this should never happen
  }
}
