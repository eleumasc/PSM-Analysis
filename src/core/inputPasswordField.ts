import locatePasswordField from "./locatePasswordField";
import { Page } from "playwright";
import { timeout } from "../util/timeout";
import {
  AnalysisTrace,
  PasswordFieldInputResult,
} from "./PasswordFieldInputResult";

const CAPTURE_TIMEOUT_MS: number = 5000;
const CLEAR_TIMEOUT_MS: number = 1000;

export default async function inputPasswordField(
  page: Page,
  domainName: string,
  signupPageUrl: string,
  passwordList: string[]
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

  for (const password of passwordList) {
    if (dirty) {
      await passwordField.fill("");
      await timeout(CLEAR_TIMEOUT_MS);
    }
    dirty = true;

    await capture(password);
    await passwordField.pressSequentially(password);
    await timeout(CAPTURE_TIMEOUT_MS);
    const fillTrace = await captureEnd();

    await capture(password);
    await passwordField.blur();
    await timeout(CAPTURE_TIMEOUT_MS);
    const blurTrace = await captureEnd();

    result.push({ password, fillTrace, blurTrace });
  }

  return result;
}
