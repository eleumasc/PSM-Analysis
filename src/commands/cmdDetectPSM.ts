import _ from "lodash";
import ConfusionMatrix from "../util/ConfusionMatrix";
import DataAccessObject, { checkAnalysisType } from "../core/DataAccessObject";
import { Completion, isFailure } from "../util/Completion";
import { detectPSM } from "../core/detection/detectPSM";
import { getIPFAbstractResultFromIPFResult } from "../core/detection/InputPasswordFieldAbstractResult";
import { getScoreTable } from "../core/detection/ScoreTable";
import { PROBE_PSM_ANALYSIS_TYPE, ProbePSMResult } from "./cmdProbePSM";
import { SEARCH_SIGNUP_PAGE_ANALYSIS_TYPE } from "./cmdSearchSignupPage";
import { SearchSignupPageResult } from "../core/searchSignupPage";
import { TRUTH } from "../data/truth";
import { writeFileSync } from "fs";

export default function cmdDetectPSM(args: {
  probeAnalysisId: number;
  dbFilepath: string | undefined;
}) {
  const dao = DataAccessObject.open(args.dbFilepath);

  const { probeAnalysisId } = args;
  const probeAnalysisModel = dao.getAnalysis(probeAnalysisId);
  checkAnalysisType(probeAnalysisModel, PROBE_PSM_ANALYSIS_TYPE);
  const spsAnalysisId = probeAnalysisModel.parentAnalysisId!;
  const spsAnalysisModel = dao.getAnalysis(spsAnalysisId);
  checkAnalysisType(spsAnalysisModel, SEARCH_SIGNUP_PAGE_ANALYSIS_TYPE);

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

  let probeDomainsCount = 0;
  const psmDetectedDomainNames: string[] = [];
  const psmDetectedConfusionMatrix = new ConfusionMatrix<string>();
  const scoreTables = [];

  for (const domainModel of dao.getDoneDomains(probeAnalysisId)) {
    const probeCompletion = dao.getAnalysisResult(
      probeAnalysisId,
      domainModel.id
    ) as Completion<ProbePSMResult>;
    if (isFailure(probeCompletion)) continue;
    const {
      value: { ipfResult },
    } = probeCompletion;
    if (!ipfResult) continue;

    probeDomainsCount += 1;

    const ipfAbstractResult = getIPFAbstractResultFromIPFResult(ipfResult);

    const psmDetected = detectPSM(ipfAbstractResult);
    if (psmDetected) {
      psmDetectedDomainNames.push(domainModel.name);
    }

    if (TRUTH.has(domainModel.name)) {
      const truth = TRUTH.get(domainModel.name)!;
      psmDetectedConfusionMatrix.addValue(
        domainModel.name,
        Boolean(psmDetected),
        truth[0]
      );
    }

    if (!psmDetected) continue;

    const { scoreTypes } = psmDetected;
    scoreTables.push({
      domain: domainModel.name,
      scoreTypes,
      scoreTable: getScoreTable(ipfAbstractResult, scoreTypes),
    });
  }

  const report = {
    accessibleDomainsCount,
    signupPagesCount,
    probeDomainsCount,
    psmDetectedDomainNames,
    psmDetectedConfusionMatrix: psmDetectedConfusionMatrix.get(),
    scoreTables,
  };

  writeFileSync("output-detect-psm.json", JSON.stringify(report, undefined, 2));

  process.exit(0);
}
