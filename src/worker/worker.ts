import {
  runQueryPasswordField,
  runSearchRegisterPage,
} from "../commands/cmdAnalyze";
import { runMeasureLoadTime } from "../commands/cmdPerformance";
import { dispatcher } from "./Task";

export default dispatcher({
  runSearchRegisterPage,
  runQueryPasswordField,
  runMeasureLoadTime,
});
