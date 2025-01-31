import findSignupForm from "./findSignupForm";
import getFormStructures, { FormStructure } from "./getFormStructures";
import { Locator, Page } from "playwright";
import { timeout } from "../util/timeout";

// NOTE: timeout is increased wrt signup page search analysis because of analysis slowdown
const NAVIGATE_EXTRA_TIMEOUT_MS: number = 10000;

export type LocatePasswordFieldResult = {
  passwordField: Locator;
  signupForm: FormStructure;
};

export default async function locatePasswordField(
  page: Page,
  domainName: string,
  signupPageUrl: string
): Promise<LocatePasswordFieldResult> {
  await page.goto(signupPageUrl);
  await timeout(NAVIGATE_EXTRA_TIMEOUT_MS);
  const formStructures = await getFormStructures(page);
  const signupForm = findSignupForm(formStructures);
  if (signupForm) {
    return getResult(signupForm);
  } else {
    throw new Error("Cannot find signup form");

    // const searchSignupPageResult = await searchSignupPage(page, domainName);
    // if (!searchSignupPageResult.signupPageUrl) {
    //   throw new Error("Cannot find signup page");
    // }
    // const formStructures = await getFormStructures(page);
    // const signupForm = findSignupForm(formStructures);
    // if (!signupForm) {
    //   throw new Error("Cannot find signup form");
    // }
    // return getResult(signupForm);
  }
}

async function getResult(
  signupForm: FormStructure
): Promise<LocatePasswordFieldResult> {
  const locator = signupForm.formLocator
    .locator('input[type="password"]')
    .first();
  if ((await locator.count()) === 0) {
    throw new Error("Cannot locate password field");
  }
  return {
    passwordField: locator,
    signupForm,
  };
}
