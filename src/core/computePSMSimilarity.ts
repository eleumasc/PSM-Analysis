import _ from "lodash";
import { weightedSpearman } from "../util/weightedSpearman";

export type ScoringEntry = {
  referenceScore: number;
  evaluatedScore: number;
  frequency: number;
};

export function computePSMSimilarity(scoring: ScoringEntry[]): number {
  return weightedSpearman(
    _.map(scoring, (s) => s.referenceScore),
    _.map(scoring, (s) => s.evaluatedScore),
    _.map(scoring, (s) => s.frequency)
  );
}
