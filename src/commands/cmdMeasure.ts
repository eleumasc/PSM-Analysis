import DataAccessObject, { checkAnalysisType } from "../core/DataAccessObject";
import { Completion, isFailure } from "../util/Completion";
import { PASSWORD_FIELD_INPUT_ANALYSIS_TYPE } from "./cmdPasswordFieldInput";
import { PasswordFieldInputResult } from "../core/PasswordFieldInputResult";
import { SearchSignupPageResult } from "../core/searchSignupPage";
import { SIGNUP_PAGE_SEARCH_ANALYSIS_TYPE } from "./cmdSignupPageSearch";
import { writeFileSync } from "fs";

export default function cmdMeasure(args: {
  pfiAnalysisId: number;
  dbFilepath: string | undefined;
}) {
  const dao = DataAccessObject.open(args.dbFilepath);

  const { pfiAnalysisId } = args;
  const pfiAnalysisModel = dao.getAnalysis(pfiAnalysisId);
  checkAnalysisType(pfiAnalysisModel, PASSWORD_FIELD_INPUT_ANALYSIS_TYPE);
  const spsAnalysisId = pfiAnalysisModel.parentAnalysisId!;
  const spsAnalysisModel = dao.getAnalysis(spsAnalysisId);
  checkAnalysisType(spsAnalysisModel, SIGNUP_PAGE_SEARCH_ANALYSIS_TYPE);

  let accessibleDomainsCount = 0;
  let signupPagesCount = 0;

  for (const domainModel of dao.getDoneDomains(spsAnalysisId)) {
    const spsCompletion = dao.getAnalysisResult(
      spsAnalysisId,
      domainModel.id
    ) as Completion<SearchSignupPageResult>;

    if (isFailure(spsCompletion)) continue;
    const { value: spsResult } = spsCompletion;

    accessibleDomainsCount += 1;

    if (spsResult.signupPageUrl !== null) {
      signupPagesCount += 1;
    }
  }

  let pfiDomainsCount = 0;
  const passwordFeedbackDomains: string[] = [];

  for (const domainModel of dao.getDoneDomains(pfiAnalysisId)) {
    const pfiCompletion = dao.getAnalysisResult(
      pfiAnalysisId,
      domainModel.id
    ) as Completion<PasswordFieldInputResult>;
    if (isFailure(pfiCompletion)) continue;
    const { value: pfiResult } = pfiCompletion;
    if (!pfiResult) continue; // TODO: fix status is success but value is undefined (serialization issue?)

    pfiDomainsCount += 1;

    if (
      pfiResult
        .flatMap((item) => [item.fillTrace, item.blurTrace])
        .some((trace) => trace.incState)
    ) {
      passwordFeedbackDomains.push(domainModel.name);
    }
  }

  const report = {
    accessibleDomainsCount,
    signupPagesCount,
    pfiDomainsCount,
    passwordFeedbackDomains,
  };

  writeFileSync("output.json", JSON.stringify(report, undefined, 2));

  process.exit(0);
}
