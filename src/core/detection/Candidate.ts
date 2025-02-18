import { InputStateRelation } from "./InputStateRelation";
import {
  AbstractCallType,
  AbstractTrace,
  getAbstractCallTypeKey,
} from "./AbstractTrace";

export type Candidate = {
  type: AbstractCallType;
  relation: InputStateRelation;
};

export function getCandidatesFromAbstractTraces(
  traces: AbstractTrace[]
): Candidate[] {
  const candidateMap = new Map<string, Candidate>();
  for (const trace of traces) {
    const { abstractCalls, incState } = trace;
    for (const abstractCall of abstractCalls) {
      const { type, value: input } = abstractCall;
      const key = getAbstractCallTypeKey(type);
      let candidate = candidateMap.get(key);
      if (!candidate) {
        candidate = {
          type,
          relation: [],
        };
        candidateMap.set(key, candidate);
      }
      const { relation } = candidate;
      relation.push({ input, state: incState });
    }
  }
  return [...candidateMap.values()];
}
