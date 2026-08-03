import _ from "lodash";
import { QPFHint } from "../queryPasswordField";
import {
  CapturePhase,
  QPFAbstractResultArray,
} from "./QPFAbstractResult";

export function mayDetectPSM(
  qpfAbstractResults: QPFAbstractResultArray
): QPFHint | null {
  const abstractTraces = qpfAbstractResults.flatMap(
    ({ abstractTraces }) => abstractTraces
  );

  const mayDetectPSMWhileCapturePhase = (capturePhase: CapturePhase) => {
    return abstractTraces.some(
      ({ capturePhase: thatCapturePhase, abstractCalls, mutationKeys }) =>
        thatCapturePhase === capturePhase &&
        (abstractCalls.length > 0 || mutationKeys.length > 0)
    );
  };

  const fillCapturing = mayDetectPSMWhileCapturePhase("fill");
  const blurCapturing = mayDetectPSMWhileCapturePhase("blur");

  return fillCapturing || blurCapturing
    ? { fillCapturing, blurCapturing }
    : null;
}
