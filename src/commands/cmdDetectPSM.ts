import _ from "lodash";
import ConfusionMatrix from "../util/ConfusionMatrix";
import DataAccessObject, { checkAnalysisType } from "../core/DataAccessObject";
import { Completion, isFailure } from "../util/Completion";
import { detectPSM } from "../core/detection/detectPSM";
import { getIPFAbstractResultFromIPFResult } from "../core/detection/InputPasswordFieldAbstractResult";
import { INPUT_PASSWORD_FIELD_ANALYSIS_TYPE } from "./cmdInputPasswordField";
import { InputPasswordFieldResult } from "../core/InputPasswordFieldResult";
import { SEARCH_SIGNUP_PAGE_ANALYSIS_TYPE } from "./cmdSearchSignupPage";
import { SearchSignupPageResult } from "../core/searchSignupPage";
import { TRUTH } from "../data/truth";
import { writeFileSync } from "fs";

export default function cmdDetectPSM(args: {
  ipfAnalysisId: number;
  dbFilepath: string | undefined;
}) {
  const dao = DataAccessObject.open(args.dbFilepath);

  const { ipfAnalysisId } = args;
  const ipfAnalysisModel = dao.getAnalysis(ipfAnalysisId);
  checkAnalysisType(ipfAnalysisModel, INPUT_PASSWORD_FIELD_ANALYSIS_TYPE);
  const spsAnalysisId = ipfAnalysisModel.parentAnalysisId!;
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

  let ipfDomainsCount = 0;
  const psmDomainNames: string[] = [];
  const psmConfusionMatrix = new ConfusionMatrix<string>();
  const scoreTables = [];

  for (const domainModel of dao.getDoneDomains(ipfAnalysisId)) {
    const ipfCompletion = dao.getAnalysisResult(
      ipfAnalysisId,
      domainModel.id
    ) as Completion<InputPasswordFieldResult>;
    if (isFailure(ipfCompletion)) continue;
    const { value: ipfResult } = ipfCompletion;

    ipfDomainsCount += 1;

    const ipfAbstractResult = getIPFAbstractResultFromIPFResult(ipfResult);

    const psmDetected = detectPSM(ipfAbstractResult);
    if (psmDetected) {
      psmDomainNames.push(domainModel.name);
    }

    if (TRUTH.has(domainModel.name)) {
      const truth = TRUTH.get(domainModel.name)!;
      psmConfusionMatrix.addValue(
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
      scoreTable: ipfAbstractResult.map(({ password, abstractTraces }) => {
        const abstractCalls = abstractTraces.flatMap(
          ({ abstractCalls }) => abstractCalls
        );
        return {
          password,
          scores: scoreTypes.map(
            (scoreType) =>
              abstractCalls.find((abstractCall) =>
                _.isEqual(abstractCall.type, scoreType)
              )?.value ?? null
          ),
        };
      }),
    });
  }

  const report = {
    accessibleDomainsCount,
    signupPagesCount,
    ipfDomainsCount,
    psmDomainNames,
    psmConfusionMatrix: psmConfusionMatrix.get(),
    scoreTables,
  };

  writeFileSync("output-detect-psm.json", JSON.stringify(report, undefined, 2));

  process.exit(0);
}
