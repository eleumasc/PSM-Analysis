import _ from "lodash";
import { InputPasswordFieldHint } from "../inputPasswordField";
import {
  CapturePhase,
  InputPasswordFieldAbstractResult,
} from "./InputPasswordFieldAbstractResult";

export function mayDetectPSM(
  ipfAbstractResult: InputPasswordFieldAbstractResult
): InputPasswordFieldHint | null {
  const abstractTraces = ipfAbstractResult.flatMap(
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
