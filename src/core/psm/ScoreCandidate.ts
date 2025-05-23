import { MutationKey } from "../InputPasswordFieldResult";
import {
  AbstractCallType,
  getAbstractCallTypeKey,
  InputPasswordFieldAbstractResult,
} from "./InputPasswordFieldAbstractResult";

export type ScoreCandidate = {
  type: AbstractCallType;
  occurrences: ScoreCandidateOccurrence[];
};

export type ScoreCandidateOccurrence = {
  password: string;
  value: number;
  mutationKeys: MutationKey[];
};

export function getScoreCandidatesFromIPFAbstractResult(
  ipfAbstractResult: InputPasswordFieldAbstractResult
): ScoreCandidate[] {
  const candidateMap = new Map<string, ScoreCandidate>();
  for (const { password, abstractTraces } of ipfAbstractResult) {
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
