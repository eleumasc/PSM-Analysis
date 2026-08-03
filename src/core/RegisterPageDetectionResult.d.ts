import { SearchRegisterPageResult } from "./searchRegisterPage";
import { Completion } from "../util/Completion";
import { Site } from "../models/Site";
import { RegisterPage } from "../models/RegisterPage";

export type RegisterPageDetectionResult = {
  searchCompletion?: Completion<SearchRegisterPageResult>;
};

export type RegisterPageDetectionResultRecord = {
  result: RegisterPageDetectionResult;
  site: Site;
  registerPage: RegisterPage | null;
};
