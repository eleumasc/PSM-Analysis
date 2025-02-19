import _ from "lodash";
import combinations from "../../util/combinations";
import { getScoreCandidatesFromPFIAbstractResult } from "./ScoreCandidate";
import {
  AbstractCallType,
  InputPasswordFieldAbstractResult,
} from "./InputPasswordFieldAbstractResult";

export type PSMDetail = {
  scoreTypes: AbstractCallType[];
};

export function detectPSM(
  ipfAbstractResult: InputPasswordFieldAbstractResult
): PSMDetail | null {
  const abstractTraces = ipfAbstractResult.flatMap(
    ({ abstractTraces }) => abstractTraces
  );

  const scoreCandidates =
    getScoreCandidatesFromPFIAbstractResult(ipfAbstractResult);

  const scoreTypes = scoreCandidates
    .filter(
      ({ occurrences }) =>
        // at least 2/3 of values returned by the function are not null
        occurrences.filter((x) => x.value !== null).length /
          occurrences.length >=
        0.66
    )
    .filter(({ type, occurrences: allOccurrences }) => {
      const occurrences = allOccurrences.filter((x) => x.value !== null);

      const propertyNameMatchesKnownPattern = () =>
        type.propertyName?.match(/score|strength|level/i);

      const constantFunction = () =>
        occurrences.every((x) => x.value === occurrences[0].value);

      const binaryFunction = () =>
        occurrences.every((x) => x.value === 0 || x.value === 1);

      const lengthFunction = () =>
        occurrences.every((x) => x.value === x.password.length);

      const characterCountFunction = () =>
        [...combinations([/[A-Z]/g, /[a-z]/g, /[0-9]/g, /[^A-Za-z0-9]/g])].some(
          (comb) =>
            occurrences.every(
              (x) =>
                x.value ===
                _.sumBy(comb, (re) => [...x.password.matchAll(re)].length)
            )
        );

      return (
        propertyNameMatchesKnownPattern() ||
        !(
          constantFunction() ||
          binaryFunction() ||
          lengthFunction() ||
          characterCountFunction()
        )
      );
    })
    .map(({ type }) => type);

  const psmDetected = abstractTraces.some(
    (abstractTrace) =>
      abstractTrace.abstractCalls.length > 0 &&
      abstractTrace.incState.length > 0 &&
      scoreTypes.length > 0
  );

  return psmDetected ? { scoreTypes } : null;
}
