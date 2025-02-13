import locatePasswordField from "./locatePasswordField";
import { Page } from "playwright";
import { timeout } from "../util/timeout";
import {
  AnalysisTrace,
  PasswordFieldInputResult,
} from "./PasswordFieldInputResult";

export const SAMPLE_WEAK_PASSWORD: string = "12345aA!";
export const SAMPLE_STRONG_PASSWORD: string = "Hg%4cvUz2^#{<~[?!Ch@";

const CAPTURING_TIMEOUT_MS: number = 5000;

export default async function inputPasswordField(
  page: Page,
  domainName: string,
  signupPageUrl: string
): Promise<PasswordFieldInputResult> {
  const {
    passwordField,
    signupForm: { frame },
  } = await locatePasswordField(page, domainName, signupPageUrl);

  const capture = (password: string): Promise<void> =>
    frame.evaluate(`\$\$ADVICE.capture(${JSON.stringify(password)})`);
  const captureEnd = (): Promise<AnalysisTrace> =>
    frame.evaluate("$$ADVICE.captureEnd()");

  const result: PasswordFieldInputResult = [];
  let dirty = false;

  await passwordField.focus();

  for (const password of [SAMPLE_WEAK_PASSWORD, SAMPLE_STRONG_PASSWORD]) {
    if (dirty) {
      await passwordField.fill("");
      await timeout(1000);
    }
    dirty = true;

    await capture(password);
    await passwordField.pressSequentially(password);
    await timeout(CAPTURING_TIMEOUT_MS);
    const fillTrace = await captureEnd();

    await capture(password);
    await passwordField.blur();
    await timeout(CAPTURING_TIMEOUT_MS);
    const blurTrace = await captureEnd();

    result.push({ password, fillTrace, blurTrace });
  }

  return result;
}
