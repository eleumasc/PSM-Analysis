import { FormStructure } from "./getFormStructures";

// signup form detection à la CookieHunter
export default function findSignupForm(
  formStructures: FormStructure[]
): FormStructure | undefined {
  return formStructures.find((fs) => {
    if (fs.passwordInputs === 0) {
      return false; // neither signup nor login
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
    } else {
      // TODO: using two sets of regular expressions (one for login and one
      // for signup) for analyzing the HTML code and detecting elements that
      // allow us to label the form accordingly.
      return false; // other
    }
  });
}
