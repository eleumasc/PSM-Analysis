import { QPFResultArray } from "./QPFResult";
import { Completion } from "../util/Completion";
import { Site } from "../models/Site";
import { RegisterPage } from "../models/RegisterPage";

export type PSMAnalysisResult = {
  recordCompletion?: Completion<{ harFile: string }>;
  testCompletion?: Completion<QPFResultArray>;
  detectCompletion?: Completion<QPFResultArray>;
  analysisCompletion?: Completion<QPFResultArray>;
};

export type PSMAnalysisResultRecord = {
  result: PSMAnalysisResult;
  registerPage: RegisterPage;
};
