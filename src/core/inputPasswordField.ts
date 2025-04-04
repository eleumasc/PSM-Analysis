import locatePasswordField from "./locatePasswordField";
import { InputPasswordFieldResult, Trace } from "./InputPasswordFieldResult";
import { Page } from "playwright";
import { timeout } from "../util/timeout";

const CAPTURE_TIMEOUT_MS: number = 3000;
const SHORT_TIMEOUT_MS: number = 500;

export type InputPasswordFieldHint = {
  fillCapturing: boolean;
  blurCapturing: boolean;
};

export default async function inputPasswordField(
  page: Page,
  options: {
    registerPageUrl: string;
    passwordList: string[];
    hint?: InputPasswordFieldHint;
  }
): Promise<InputPasswordFieldResult> {
  const { registerPageUrl, passwordList, hint } = options;

  const {
    passwordField,
    registerForm: { frame },
  } = await locatePasswordField(page, { registerPageUrl });

  const capture = (password: string): Promise<void> =>
    frame.evaluate(`\$\$ADVICE.capture(${JSON.stringify(password)})`);
  const captureEnd = (): Promise<Trace> =>
    frame.evaluate("$$ADVICE.captureEnd()");

  const result: InputPasswordFieldResult = [];
  let dirty = false;

  await passwordField.focus();

  for (const password of passwordList) {
    if (dirty) {
      await passwordField.fill("");
      await timeout(SHORT_TIMEOUT_MS);
    }
    dirty = true;

    let fillTrace: Trace | undefined;
    if (hint?.fillCapturing ?? true) {
      await capture(password);
      await passwordField.pressSequentially(password);
      await timeout(CAPTURE_TIMEOUT_MS);
      fillTrace = await captureEnd();
    } else {
      await passwordField.pressSequentially(password);
      await timeout(SHORT_TIMEOUT_MS);
    }

    let blurTrace: Trace | undefined;
    if (hint?.blurCapturing ?? true) {
      await capture(password);
      await passwordField.blur();
      await timeout(CAPTURE_TIMEOUT_MS);
      blurTrace = await captureEnd();
    }

    result.push({ password, fillTrace, blurTrace });
  }

  return result;
}
