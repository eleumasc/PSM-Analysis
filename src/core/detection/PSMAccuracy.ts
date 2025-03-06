import _ from "lodash";
import { weightedSpearman } from "../../util/weightedSpearman";

export type PSMAccuracyScoreEntry = {
  referenceScore: number;
  evaluatedScore: number;
  frequency: number;
};

export function getPSMAccuracy(entries: PSMAccuracyScoreEntry[]): number {
  return weightedSpearman(
    _.map(entries, (e) => e.referenceScore),
    _.map(entries, (e) => e.evaluatedScore),
    _.map(entries, (e) => e.frequency)
  );
}
