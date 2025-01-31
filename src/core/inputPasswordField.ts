import locatePasswordField from "./locatePasswordField";
import { Page } from "playwright";
import { timeout } from "../util/timeout";
import {
  AnalysisTrace,
  PasswordFieldInputResult,
} from "./PasswordFieldInputResult";

export const SAMPLE_WEAK_PASSWORD: string = "1234";
export const SAMPLE_STRONG_PASSWORD: string = "Hg%4cvUz2^#{<~[?!Ch@";

const CAPTURING_TIMEOUT_MS: number = 5000;

export default async function inputPasswordField(
  page: Page,
  domain: string,
  signupPageUrl: string
): Promise<PasswordFieldInputResult> {
  const {
    passwordField,
    signupForm: { frame },
  } = await locatePasswordField(page, domain, signupPageUrl);

  const capture = (): Promise<void> => frame.evaluate("$$ADVICE.capture()");
  const captureEnd = (): Promise<AnalysisTrace> =>
    frame.evaluate("$$ADVICE.captureEnd()");

  await passwordField.focus();

  await capture();
  await passwordField.fill(SAMPLE_WEAK_PASSWORD);
  await timeout(CAPTURING_TIMEOUT_MS);
  const traceWeakFill = await captureEnd();

  await capture();
  await passwordField.blur();
  await timeout(CAPTURING_TIMEOUT_MS);
  const traceWeakBlur = await captureEnd();

  await passwordField.fill("");

  await capture();
  await passwordField.fill(SAMPLE_STRONG_PASSWORD);
  await timeout(CAPTURING_TIMEOUT_MS);
  const traceStrongFill = await captureEnd();

  await capture();
  await passwordField.blur();
  await timeout(CAPTURING_TIMEOUT_MS);
  const traceStrongBlur = await captureEnd();

  return {
    traceWeakFill,
    traceWeakBlur,
    traceStrongFill,
    traceStrongBlur,
  };
}
