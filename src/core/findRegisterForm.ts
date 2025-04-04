import { FormStructure } from "./getFormStructures";

// register form detection à la CookieHunter
export default function findRegisterForm(
  formStructures: FormStructure[]
): FormStructure | undefined {
  return formStructures.find((fs) => {
    if (fs.passwordInputs === 0) {
      return false; // neither register nor login
    } else if (fs.passwordInputs > 1) {
      return true;
    } else if (fs.textInputs === 1) {
      return false; // login
    } else if (
      fs.textInputs > 1 ||
      fs.checkboxInputs > 1 ||
      fs.radioInputs > 1
    ) {
      return true;
    } else if (fs.registerFormFieldsDetected) {
      return true;
    } else {
      return false; // other
    }
  });
}
