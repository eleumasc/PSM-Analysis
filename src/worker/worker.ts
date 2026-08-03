import {
  runQueryPasswordField,
  runSearchRegisterPage,
} from "../commands/cmdAnalyze";
import { dispatcher } from "./Task";

export default dispatcher({
  runSearchRegisterPage,
  runQueryPasswordField,
});
