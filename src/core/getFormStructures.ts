import { Page } from "playwright";

export interface FormStructure {
  textInputs: number;
  passwordInputs: number;
  checkboxInputs: number;
  radioInputs: number;
}

export default async function getFormStructures(page: Page) {
  return (
    await Promise.allSettled(
      page
        .frames()
        .filter((frame) => frame.url()) // see https://github.com/microsoft/playwright/issues/9675
        .map(
          (frame): Promise<FormStructure[]> =>
            frame.locator("form").evaluateAll(getFormStructuresPageFunction)
        )
    )
  )
    .filter((result) => result.status === "fulfilled")
    .flatMap(({ value }) => value);
}

const getFormStructuresPageFunction = (
  forms: HTMLFormElement[]
): FormStructure[] => {
  // element visibility heuristics à la Playwright
  const isVisible = (element: HTMLElement) => {
    const boundingBox = element.getBoundingClientRect();
    if (boundingBox.width === 0 || boundingBox.height === 0) {
      return false;
    }
    const computedStyle = getComputedStyle(element);
    if (computedStyle.visibility !== "visible") {
      return false;
    }
    return true;
  };

  const getFormStructure = (form: HTMLFormElement): FormStructure => {
    const names: Record<string, boolean> = {
      // @ts-ignore
      __proto__: null,
    };
    const formStructure: FormStructure = {
      textInputs: 0,
      passwordInputs: 0,
      checkboxInputs: 0,
      radioInputs: 0,
    };
    for (const inputElement of form.querySelectorAll("input")) {
      if (!isVisible(inputElement)) continue;
      const { name, type } = inputElement as HTMLInputElement;
      if (!name || !names[name]) {
        switch (type) {
          case "text":
          case "email":
            formStructure.textInputs += 1;
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
        if (name) {
          names[name] = true;
        }
      }
    }
    return formStructure;
  };

  return forms.map((form) => getFormStructure(form));
};
