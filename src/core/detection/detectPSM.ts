import _ from "lodash";
import combinations from "../../util/combinations";
import { getScoreCandidatesFromPFIAbstractResult } from "./ScoreCandidate";
import {
  reDigit,
  reLower,
  reSpecial,
  reUpper
  } from "../../data/regexps";
import { SELECTED_DETAILED_PASSWORD_GROUPS } from "../../data/passwords";
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
    .filter(({ type, occurrences }) => {
      const doesPropertyNameMatchesKnownPattern = () =>
        type.propertyName?.match(/score|strength|level/i);

      const isConstantFunction = () =>
        occurrences.every((occ) => occ.value === occurrences[0].value);

      const isLengthFunction = () =>
        occurrences.every((occ) => occ.value === occ.password.length);

      const isCharacterCountFunction = () =>
        [...combinations([reLower, reUpper, reDigit, reSpecial])].some((comb) =>
          occurrences.every(
            (occ) =>
              occ.value ===
              _.sumBy(comb, (re) => [...occ.password.matchAll(re())].length)
          )
        );

      return (
        doesPropertyNameMatchesKnownPattern() ||
        !(
          isConstantFunction() ||
          isLengthFunction() ||
          isCharacterCountFunction()
        )
      );
    })
    .filter(({ occurrences }) =>
      SELECTED_DETAILED_PASSWORD_GROUPS.every((group) =>
        group
          .flatMap((detailedPassword) => {
            const found = occurrences.find(
              (occ) => occ.password === detailedPassword.password
            );
            return found ? [found] : [];
          })
          .map(({ value }) => value)
          .every((value, i, a) => i === 0 || a[i - 1] <= value)
      )
    )
    .map(({ type }) => type);

  const psmDetected = abstractTraces.some(
    (abstractTrace) =>
      abstractTrace.abstractCalls.length > 0 &&
      abstractTrace.incState.length > 0 &&
      scoreTypes.length > 0
  );

  return psmDetected ? { scoreTypes } : null;
}
