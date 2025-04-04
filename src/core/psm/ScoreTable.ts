import _ from "lodash";
import {
  AbstractCallType,
  InputPasswordFieldAbstractResult,
} from "./InputPasswordFieldAbstractResult";

export type ScoreTable = ScoreTableRow[];

export type ScoreTableRow = {
  password: string;
  scores: (number | undefined)[];
};

export function getScoreTable(
  ipfAbstractResult: InputPasswordFieldAbstractResult,
  scoreTypes: AbstractCallType[]
): ScoreTable {
  return ipfAbstractResult.map(({ password, abstractTraces }) => {
    const abstractCalls = abstractTraces.flatMap(
      ({ abstractCalls }) => abstractCalls
    );
    return {
      password,
      scores: scoreTypes.map(
        (scoreType) =>
          abstractCalls.find((abstractCall) =>
            _.isEqual(abstractCall.type, scoreType)
          )?.value
      ),
    };
  });
}
