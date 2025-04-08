import _ from "lodash";
import combinations from "../../util/combinations";
import { isAscending, isConstant, isDescending } from "../../util/sorting";
import { MONOTONE_TEST_PASSWORDS_SEQUENCES } from "../../data/passwords";
import {
  reDigit,
  reLower,
  reSpecial,
  reUpper
  } from "../../data/regexps";
import {
  getScoreCandidatesFromPFIAbstractResult,
  ScoreCandidate,
} from "./ScoreCandidate";
import {
  AbstractCallType,
  InputPasswordFieldAbstractResult,
} from "./InputPasswordFieldAbstractResult";

export type PSMDetail = {
  scoreTypes: AbstractCallType[];
};

const isConstantFunction = ({ occurrences }: ScoreCandidate) =>
  isConstant(occurrences.map(({ value }) => value));

const isLengthFunction = ({ occurrences }: ScoreCandidate) =>
  occurrences.every((occ) => occ.value === occ.password.length);

const isCharacterCountFunction = ({ occurrences }: ScoreCandidate) =>
  [...combinations([reLower, reUpper, reDigit, reSpecial])].some((comb) =>
    occurrences.every(
      (occ) =>
        occ.value ===
        _.sumBy(comb, (re) => [...occ.password.matchAll(re())].length)
    )
  );

const isMonotoneFunction = ({ occurrences }: ScoreCandidate) =>
  MONOTONE_TEST_PASSWORDS_SEQUENCES.every((group) => {
    const values = group
      .flatMap((password) => {
        const found = occurrences.find((occ) => occ.password === password);
        return found ? [found] : [];
      })
      .map(({ value }) => value);
    return isAscending(values) || isDescending(values);
  });

export function detectPSM(
  ipfAbstractResult: InputPasswordFieldAbstractResult
): PSMDetail | null {
  const scoreCandidates =
    getScoreCandidatesFromPFIAbstractResult(ipfAbstractResult);

  const scoreTypes = scoreCandidates
    .filter(
      (scoreCandidate) =>
        !isConstantFunction(scoreCandidate) &&
        !isLengthFunction(scoreCandidate) &&
        !isCharacterCountFunction(scoreCandidate)
    )
    .filter((scoreCandidate) => isMonotoneFunction(scoreCandidate))
    .map(({ type }) => type);

  return scoreTypes.length > 0 ? { scoreTypes } : null;
}

export function getDetectPSMFilteringDetail(
  ipfAbstractResult: InputPasswordFieldAbstractResult
) {
  const scoreCandidates =
    getScoreCandidatesFromPFIAbstractResult(ipfAbstractResult);

  const constantFunctionsCount = scoreCandidates.filter((scoreCandidate) =>
    isConstantFunction(scoreCandidate)
  ).length;

  const lengthFunctionsCount = scoreCandidates.filter((scoreCandidate) =>
    isLengthFunction(scoreCandidate)
  ).length;

  const characterCountFunctionsCount = scoreCandidates.filter(
    (scoreCandidate) => isCharacterCountFunction(scoreCandidate)
  ).length;

  const notMonotoneFunctionsCount = scoreCandidates.filter(
    (scoreCandidate) => !isMonotoneFunction(scoreCandidate)
  ).length;

  return {
    constantFunctionsCount,
    lengthFunctionsCount,
    characterCountFunctionsCount,
    notMonotoneFunctionsCount,
  };
}
