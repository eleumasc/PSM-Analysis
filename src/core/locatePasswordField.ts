import findRegisterForm from "./findRegisterForm";
import getFormStructures, { FormStructure } from "./getFormStructures";
import { Locator, Page } from "playwright";
import { timeout } from "../util/timeout";

// NOTE: timeout is increased wrt register page search analysis because of analysis slowdown
const NAVIGATE_EXTRA_TIMEOUT_MS: number = 10000;

export type LocatePasswordFieldResult = {
  passwordField: Locator;
  registerForm: FormStructure;
};

export default async function locatePasswordField(
  page: Page,
  options: {
    // site: string;
    registerPageUrl: string;
  }
): Promise<LocatePasswordFieldResult> {
  const { registerPageUrl } = options;

  await page.goto(registerPageUrl);
  await timeout(NAVIGATE_EXTRA_TIMEOUT_MS);
  const formStructures = await getFormStructures(page);
  const registerForm = findRegisterForm(formStructures);
  if (registerForm) {
    return getResult(registerForm);
  } else {
    throw new Error("Cannot find register form");

    // const searchRegisterPageResult = await searchRegisterPage(page, site);
    // if (!searchRegisterPageResult.registerPageUrl) {
    //   throw new Error("Cannot find register page");
    // }
    // const formStructures = await getFormStructures(page);
    // const registerForm = findRegisterForm(formStructures);
    // if (!registerForm) {
    //   throw new Error("Cannot find register form");
    // }
    // return getResult(registerForm);
  }
}

async function getResult(
  registerForm: FormStructure
): Promise<LocatePasswordFieldResult> {
  const locator = registerForm.formLocator
    .locator('input[type="password"]')
    .first();
  if ((await locator.count()) === 0) {
    throw new Error("Cannot locate password field");
  }
  return {
    passwordField: locator,
    registerForm,
  };
}
