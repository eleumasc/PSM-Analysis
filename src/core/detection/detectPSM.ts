import _ from "lodash";
import { findFunctionalStateKeys } from "./InputStateRelation";
import { getCandidatesFromAbstractTraces } from "./Candidate";
import {
  AbstractTrace,
  getAbstractTraceFromAnalysisTrace,
} from "./AbstractTrace";
import {
  AnalysisTrace,
  PasswordFieldInputResult,
} from "../PasswordFieldInputResult";

export function detectPSM(pfiResult: PasswordFieldInputResult): boolean {
  const traces = pfiResult.flatMap(({ password, fillTrace, blurTrace }) =>
    [fillTrace, blurTrace]
      .map((analysisTrace): AnalysisTrace => {
        const { functionCalls, xhrRequests, incState } = analysisTrace;
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
          incState,
        };
      })
      .map(
        (analysisTrace): AbstractTrace =>
          getAbstractTraceFromAnalysisTrace(analysisTrace)
      )
  );

  const candidates = getCandidatesFromAbstractTraces(traces);
  const scoreCallTypes = candidates
    .filter(({ relation }) => findFunctionalStateKeys(relation).length > 0)
    .map(({ type }) => type);

  const result = traces.some(
    (trace) =>
      trace.abstractCalls.length > 0 &&
      trace.incState.length > 0 &&
      scoreCallTypes.length > 0
  );

  // if (result) {
  //   console.log(scoreCallTypes);
  // }

  return result;
}
