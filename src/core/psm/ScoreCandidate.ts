import { MutationKey } from "../QPFResult";
import {
  AbstractCallType,
  getAbstractCallTypeKey,
  QPFAbstractResultArray,
} from "./QPFAbstractResult";

export type ScoreCandidate = {
  type: AbstractCallType;
  occurrences: ScoreCandidateOccurrence[];
};

export type ScoreCandidateOccurrence = {
  password: string;
  value: number;
  mutationKeys: MutationKey[];
};

export function getScoreCandidatesFromQPFAbstractResults(
  qpfAbstractResults: QPFAbstractResultArray
): ScoreCandidate[] {
  const candidateMap = new Map<string, ScoreCandidate>();
  for (const { password, abstractTraces } of qpfAbstractResults) {
    for (const trace of abstractTraces) {
      const { abstractCalls, mutationKeys } = trace;
      for (const abstractCall of abstractCalls) {
        const { type, value } = abstractCall;
        const key = getAbstractCallTypeKey(type);
        let candidate = candidateMap.get(key);
        if (!candidate) {
          candidate = {
            type,
            occurrences: [],
          };
          candidateMap.set(key, candidate);
        }
        const { occurrences } = candidate;
        occurrences.push({ password, value, mutationKeys });
      }
    }
  }
  return [...candidateMap.values()];
}
