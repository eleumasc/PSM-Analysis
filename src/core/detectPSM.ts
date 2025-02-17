import canParseJSON from "../util/canParseJSON";
import mayBeScore from "../core/mayBeScore";
import { PasswordFieldInputResult } from "../core/PasswordFieldInputResult";

export function detectPSM(pfiResult: PasswordFieldInputResult): boolean {
  const traces = pfiResult.flatMap(({ password, fillTrace, blurTrace }) =>
    [fillTrace, blurTrace].map((trace) => {
      const { functionCalls, xhrRequests, incState } = trace;
      return {
        functionCalls,
        xhrRequests: xhrRequests
          .map((xhrRequest) => {
            const { method, url, body, status, responseText } = xhrRequest;
            return {
              method,
              url,
              body,
              status,
              response: canParseJSON(responseText)
                ? JSON.parse(responseText)
                : responseText,
            };
          })
          .filter((xhrRequest) => {
            const { url, body, response } = xhrRequest;
            return (
              (url.includes(encodeURIComponent(password)) ||
                body.includes(password) ||
                body.includes(JSON.stringify(password)) ||
                body.includes(encodeURIComponent(password))) &&
              (mayBeScore(response) ||
                (typeof response === "object" &&
                  Object.values(response).some((value) => mayBeScore(value))))
            );
          }),
        incState,
      };
    })
  );

  return traces.some(
    (trace) =>
      (trace.functionCalls.length > 0 || trace.xhrRequests.length > 0) &&
      trace.incState.length > 0
  );
}
