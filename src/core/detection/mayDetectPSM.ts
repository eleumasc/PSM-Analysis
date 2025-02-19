import _ from "lodash";
import { InputPasswordFieldAbstractResult } from "./InputPasswordFieldAbstractResult";

export function mayDetectPSM(
  ipfAbstractResult: InputPasswordFieldAbstractResult
): boolean {
  const abstractTraces = ipfAbstractResult.flatMap(
    ({ abstractTraces }) => abstractTraces
  );

  return abstractTraces.some(
    (abstractTrace) =>
      abstractTrace.abstractCalls.length > 0 &&
      abstractTrace.incState.length > 0
  );
}
