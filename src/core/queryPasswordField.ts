import locatePasswordField from "./locatePasswordField";
import { QPFResultArray, Trace } from "./QPFResult";
import { Page } from "playwright";
import { timeout } from "../util/timeout";

const CAPTURE_TIMEOUT_MS: number = 3000;

const SHORT_TIMEOUT_MS: number = 500;

export type QPFHint = {
  fillCapturing: boolean;
  blurCapturing: boolean;
};

export default async function queryPasswordField(
  page: Page,
  options: {
    rpUrl: string;
    passwordArray: string[];
    hint?: QPFHint;
    isSimulating?: boolean;
  }
): Promise<QPFResultArray> {
  const { rpUrl, passwordArray, hint, isSimulating } = options;

  const {
    passwordField,
    registerForm: { frame },
  } = await locatePasswordField(page, { rpUrl });

  const capture = async (password: string): Promise<void> => {
    if (!isSimulating) {
      return frame.evaluate(`\$\$ADVICE.capture(${JSON.stringify(password)})`);
    }
  };
  const captureEnd = async (): Promise<Trace | undefined> => {
    if (!isSimulating) {
      return frame.evaluate("$$ADVICE.captureEnd()");
    }
  };

  const results: QPFResultArray = [];
  let dirty = false;

  await passwordField.focus();

  for (const password of passwordArray) {
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

    results.push({ password, fillTrace, blurTrace });
  }

  return results;
}
