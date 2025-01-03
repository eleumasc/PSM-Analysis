import { Page } from "playwright";

export interface DetectLoginOrRegisterPageResult {
  loginPageDetected: boolean;
  registerPageDetected: boolean;
}

interface FormStructure {
  textInputs: number;
  emailInputs: number;
  passwordInputs: number;
  checkboxInputs: number;
  radioInputs: number;
}

const loginPageDetectedResult: DetectLoginOrRegisterPageResult = {
  loginPageDetected: true,
  registerPageDetected: false,
};

const registerPageDetectedResult: DetectLoginOrRegisterPageResult = {
  loginPageDetected: false,
  registerPageDetected: true,
};

const otherPageDetectedResult: DetectLoginOrRegisterPageResult = {
  loginPageDetected: false,
  registerPageDetected: false,
};

// login or register page detection à la CookieHunter
export default async function detectLoginOrRegisterPage(
  page: Page
): Promise<DetectLoginOrRegisterPageResult> {
  const results = (
    await Promise.allSettled(
      page
        .frames()
        .map(
          (frame): Promise<FormStructure[]> =>
            frame.locator("form").evaluateAll(getFormStructures)
        )
    )
  )
    .filter((result) => result.status === "fulfilled")
    .flatMap(({ value }) => value)
    .map((fs) => {
      if (fs.passwordInputs === 0) {
        return otherPageDetectedResult;
      } else if (fs.passwordInputs > 1) {
        return registerPageDetectedResult;
      } else if (
        fs.passwordInputs === 1 &&
        (fs.textInputs === 1 || fs.emailInputs === 1)
      ) {
        return loginPageDetectedResult;
      } else if (
        fs.textInputs > 1 ||
        fs.emailInputs > 1 ||
        fs.checkboxInputs > 1 ||
        fs.radioInputs > 1
      ) {
        return registerPageDetectedResult;
      } else {
        // TODO: using two sets of regular expressions (one for login and one
        // for register) for analyzing the HTML code and detecting elements
        // that allow us to label the form accordingly.
        return otherPageDetectedResult;
      }
    });

  return {
    loginPageDetected: results.some(
      ({ loginPageDetected }) => loginPageDetected
    ),
    registerPageDetected: results.some(
      ({ registerPageDetected }) => registerPageDetected
    ),
  };
}

// pageFunction
const getFormStructures = (forms: HTMLFormElement[]): FormStructure[] => {
  const getFormStructure = (form: HTMLFormElement): FormStructure => {
    const names: Record<string, boolean> = {
      // @ts-ignore
      __proto__: null,
    };
    const formStructure: FormStructure = {
      textInputs: 0,
      emailInputs: 0,
      passwordInputs: 0,
      checkboxInputs: 0,
      radioInputs: 0,
    };
    for (const inputElement of form.querySelectorAll("input")) {
      const { name, type } = inputElement as HTMLInputElement;
      if (!names[name]) {
        switch (type) {
          case "text":
            formStructure.textInputs += 1;
            break;
          case "email":
            formStructure.emailInputs += 1;
            break;
          case "password":
            formStructure.passwordInputs += 1;
            break;
          case "checkbox":
            formStructure.checkboxInputs += 1;
            break;
          case "radio":
            formStructure.radioInputs += 1;
            break;
        }
        names[name] = true;
      }
    }
    return formStructure;
  };

  return forms.map((form) => getFormStructure(form));
};
