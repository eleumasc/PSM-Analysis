import locatePasswordField from "./locatePasswordField";
import { Page } from "playwright";
import { timeout } from "../util/timeout";

const CAPTURE_TIMEOUT_MS: number = 5000;

export default async function inputPasswordField(
  page: Page,
  domain: string,
  signupPageUrl: string
) {
  const {
    passwordField,
    signupForm: { frame },
  } = await locatePasswordField(page, domain, signupPageUrl);

  await frame.evaluate("$$ADVICE.capture()");
  await passwordField.fill("Hg%4cvUz2^#{<~[?!Ch@"); // strong password
  await timeout(CAPTURE_TIMEOUT_MS);
  const trace = await frame.evaluate("$$ADVICE.captureEnd()");

  return trace;
}
