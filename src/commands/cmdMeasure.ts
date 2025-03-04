import _ from "lodash";
import assert from "assert";
import DataAccessObject, { checkAnalysisType } from "../core/DataAccessObject";
import { Completion, isFailure } from "../util/Completion";
import { detectPSM } from "../core/detection/detectPSM";
import { getIPFAbstractResultFromIPFResult } from "../core/detection/InputPasswordFieldAbstractResult";
import { INPUT_PASSWORD_FIELD_ANALYSIS_TYPE } from "./cmdInputPasswordField";
import { InputPasswordFieldResult } from "../core/InputPasswordFieldResult";
import { QUERY_PSM_ANALYSIS_TYPE } from "./cmdQueryPSM";
import { ROCKYOU2021_PASSWORD_ROWS } from "../data/rockyou2021";
import { writeFileSync } from "fs";
import {
  computePSMSimilarity,
  ScoringEntry,
} from "../core/computePSMSimilarity";

export default function cmdMeasure(args: {
  qryAnalysisId: number;
  dbFilepath: string | undefined;
}) {
  const dao = DataAccessObject.open(args.dbFilepath);

  const { qryAnalysisId } = args;
  const qryAnalysisModel = dao.getAnalysis(qryAnalysisId);
  checkAnalysisType(qryAnalysisModel, QUERY_PSM_ANALYSIS_TYPE);
  const ipfAnalysisId = qryAnalysisModel.parentAnalysisId!;
  const ipfAnalysisModel = dao.getAnalysis(ipfAnalysisId);
  checkAnalysisType(ipfAnalysisModel, INPUT_PASSWORD_FIELD_ANALYSIS_TYPE);

  const similarityArrays = [];

  for (const domainModel of dao.getDoneDomains(qryAnalysisId)) {
    const qryCompletion = dao.getAnalysisResult(
      qryAnalysisId,
      domainModel.id
    ) as Completion<InputPasswordFieldResult>;
    if (isFailure(qryCompletion)) continue;
    const { value: qryResult } = qryCompletion;

    const ipfCompletion = dao.getAnalysisResult(
      ipfAnalysisId,
      domainModel.id
    ) as Completion<InputPasswordFieldResult>;
    if (isFailure(ipfCompletion)) continue;
    const { value: ipfResult } = ipfCompletion;

    const qryAbstractResult = getIPFAbstractResultFromIPFResult(qryResult);
    const ipfAbstractResult = getIPFAbstractResultFromIPFResult(ipfResult);

    const psmDetected = detectPSM(ipfAbstractResult);
    assert(psmDetected);

    const { scoreTypes } = psmDetected;
    const similarityArray = scoreTypes.map((scoreType) => {
      const scoring = ROCKYOU2021_PASSWORD_ROWS.flatMap(
        ([password, frequency], rankIndex): ScoringEntry[] => {
          const abstractCalls = qryAbstractResult
            .find(
              ({ password: passwordSearched }) => passwordSearched === password
            )
            ?.abstractTraces.flatMap(({ abstractCalls }) => abstractCalls);
          assert(abstractCalls);
          const evaluatedScore = abstractCalls.find((abstractCall) =>
            _.isEqual(abstractCall.type, scoreType)
          )?.value;
          if (typeof evaluatedScore === "undefined") return [];
          return [
            {
              frequency: frequency,
              referenceScore: rankIndex + 1,
              evaluatedScore,
            },
          ];
        }
      );
      const similarity = computePSMSimilarity(scoring);
      return { scoreType, similarity };
    });

    similarityArrays.push({
      domain: domainModel.name,
      similarityArray,
    });
  }

  const report = {
    similarityArrays,
  };

  writeFileSync("output-measure.json", JSON.stringify(report, undefined, 2));

  process.exit(0);
}
