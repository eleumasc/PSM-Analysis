import _ from "lodash";
import {
  AbstractCallType,
  InputPasswordFieldAbstractResult,
} from "./InputPasswordFieldAbstractResult";
import assert from "assert";

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
            sameAbstractCallType(abstractCall.type, scoreType)
          )?.value
      ),
    };
  });
}

function sameAbstractCallType(
  a: AbstractCallType,
  b: AbstractCallType
): boolean {
  let r = true;
  if (a.kind !== b.kind) {
    return false;
  } else if (a.kind === "functionCall") {
    assert(b.kind === "functionCall");
    const {
      sourceLoc: [aUrl, aBegin, aEnd],
    } = a;
    const {
      sourceLoc: [bUrl, bBegin, bEnd],
    } = b;
    r &&= aEnd - aBegin === bEnd - bBegin;
    if (r) {
      r &&= new URL(aUrl).origin === new URL(bUrl).origin;
    }
  } else if (a.kind === "xhrRequest") {
    assert(b.kind === "xhrRequest");
    r &&= a.url === b.url;
  } else {
    return false;
  }
  r &&= a.propertyName === b.propertyName;
  return r;
}
