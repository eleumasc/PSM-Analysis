import _ from "lodash";
import combinations from "../../util/combinations";
import { isAscending, isConstant, isDescending } from "../../util/sorting";
import { getMonotoneTestPasswordSequences } from "../../data/passwords";
import { reDigit, reLower, reSpecial, reUpper } from "../../util/regexps";
import {
  getScoreCandidatesFromQPFAbstractResults as getScoreCandidatesFromQPFAbstractResults,
  ScoreCandidate,
} from "./ScoreCandidate";
import {
  AbstractCallType,
  QPFAbstractResultArray,
} from "./QPFAbstractResult";

export type PSMDetail = {
  scoreTypes: AbstractCallType[];
};

export type ScoreCandidateFilteringDetail = Record<string, number>;

const isConstantCandidate = ({ occurrences }: ScoreCandidate) =>
  isConstant(occurrences.map(({ value }) => value));

const isLengthCandidate = ({ occurrences }: ScoreCandidate) =>
  occurrences.every((occ) => occ.value === occ.password.length);

const isCharacterCountCandidate = ({ occurrences }: ScoreCandidate) =>
  [...combinations([reLower, reUpper, reDigit, reSpecial])]
    .filter((comb) => comb.length !== 0 && comb.length !== 4)
    .some((comb) =>
      occurrences.every(
        (occ) =>
          occ.value ===
          _.sumBy(comb, (re) => [...occ.password.matchAll(re())].length)
      )
    );

const isMonotoneCandidate = ({ occurrences }: ScoreCandidate) =>
  getMonotoneTestPasswordSequences().every((group) => {
    const values = group
      .flatMap((password) => {
        const found = occurrences.find((occ) => occ.password === password);
        return found ? [found] : [];
      })
      .map(({ value }) => value);
    return isAscending(values) || isDescending(values);
  });

export function detectPSM(
  qpfAbstractResults: QPFAbstractResultArray
): PSMDetail | null {
  const scoreCandidates =
    getScoreCandidatesFromQPFAbstractResults(qpfAbstractResults);

  const scoreTypes = scoreCandidates
    .filter(
      (scoreCandidate) =>
        !isConstantCandidate(scoreCandidate) &&
        !isLengthCandidate(scoreCandidate) &&
        !isCharacterCountCandidate(scoreCandidate) &&
        isMonotoneCandidate(scoreCandidate)
    )
    .map(({ type }) => type);

  return scoreTypes.length > 0 ? { scoreTypes } : null;
}

export function getScoreCandidateFilteringDetail(
  qpfAbstractResults: QPFAbstractResultArray
): ScoreCandidateFilteringDetail {
  const scoreCandidates =
    getScoreCandidatesFromQPFAbstractResults(qpfAbstractResults);

  const allCandidatesCount = scoreCandidates.length;

  const filteredCandidatesCount = scoreCandidates.filter(
    (scoreCandidate) =>
      !isConstantCandidate(scoreCandidate) &&
      !isLengthCandidate(scoreCandidate) &&
      !isCharacterCountCandidate(scoreCandidate) &&
      isMonotoneCandidate(scoreCandidate)
  ).length;

  const constantCandidatesCount = scoreCandidates.filter((scoreCandidate) =>
    isConstantCandidate(scoreCandidate)
  ).length;

  const lengthCandidatesCount = scoreCandidates.filter((scoreCandidate) =>
    isLengthCandidate(scoreCandidate)
  ).length;

  const characterCountCandidatesCount = scoreCandidates.filter(
    (scoreCandidate) => isCharacterCountCandidate(scoreCandidate)
  ).length;

  const nonMonotoneCandidatesCount = scoreCandidates.filter(
    (scoreCandidate) => !isMonotoneCandidate(scoreCandidate)
  ).length;

  return {
    allCandidatesCount,
    filteredCandidatesCount,
    constantCandidatesCount,
    lengthCandidatesCount,
    characterCountCandidatesCount,
    nonMonotoneCandidatesCount,
  };
}
