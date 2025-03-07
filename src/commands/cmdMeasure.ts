import _ from "lodash";
import assert from "assert";
import DataAccessObject, { checkAnalysisType } from "../core/DataAccessObject";
import { Completion, isFailure } from "../util/Completion";
import { detectPSM } from "../core/detection/detectPSM";
import { getIPFAbstractResultFromIPFResult } from "../core/detection/InputPasswordFieldAbstractResult";
import { getScoreTable } from "../core/detection/ScoreTable";
import { PROBE_PSM_ANALYSIS_TYPE, ProbePSMResult } from "./cmdProbePSM";
import { QUERY_PSM_ANALYSIS_TYPE, QueryPSMResult } from "./cmdQueryPSM";
import { ROCKYOU2021_PASSWORD_ROWS } from "../data/rockyou2021";
import { writeFileSync } from "fs";
import {
  getPSMAccuracy,
  PSMAccuracyScoreEntry,
} from "../core/detection/PSMAccuracy";

export default function cmdMeasure(args: {
  queryAnalysisId: number;
  dbFilepath: string | undefined;
}) {
  const dao = DataAccessObject.open(args.dbFilepath);

  const { queryAnalysisId } = args;
  const queryAnalysisModel = dao.getAnalysis(queryAnalysisId);
  checkAnalysisType(queryAnalysisModel, QUERY_PSM_ANALYSIS_TYPE);
  const probeAnalysisId = queryAnalysisModel.parentAnalysisId!;
  const probeAnalysisModel = dao.getAnalysis(probeAnalysisId);
  checkAnalysisType(probeAnalysisModel, PROBE_PSM_ANALYSIS_TYPE);

  const domainAccuracyEntries = [];

  for (const domainModel of dao.getDoneDomains(queryAnalysisId)) {
    const queryCompletion = dao.getAnalysisResult(
      queryAnalysisId,
      domainModel.id
    ) as Completion<QueryPSMResult>;
    if (isFailure(queryCompletion)) continue;
    const {
      value: { ipfResult: queryIpfResult },
    } = queryCompletion;

    const probeCompletion = dao.getAnalysisResult(
      probeAnalysisId,
      domainModel.id
    ) as Completion<ProbePSMResult>;
    if (isFailure(probeCompletion)) continue;
    const {
      value: { ipfResult: probeIpfResult },
    } = probeCompletion;
    assert(probeIpfResult);

    const queryAbstractResult =
      getIPFAbstractResultFromIPFResult(queryIpfResult);
    const probeAbstractResult =
      getIPFAbstractResultFromIPFResult(probeIpfResult);

    const psmDetected = detectPSM(probeAbstractResult);
    assert(psmDetected);

    const { scoreTypes } = psmDetected;

    const scoreTable = getScoreTable(queryAbstractResult, scoreTypes);

    const accuracyEntries = _.map(scoreTypes, (scoreType) => {
      const scoreTypeIndex = scoreTypes.indexOf(scoreType);
      assert(scoreTypeIndex !== -1);
      const extendedScoreEntries = _.map(
        ROCKYOU2021_PASSWORD_ROWS,
        ([password, frequency], rankIndex) => {
          const scoreTableRow = scoreTable.find(
            ({ password: passwordSearched }) => passwordSearched === password
          );
          assert(scoreTableRow);
          const evaluatedScore = scoreTableRow.scores[scoreTypeIndex];
          return { frequency, referenceScore: rankIndex + 1, evaluatedScore };
        }
      );
      const scores = _.map(extendedScoreEntries, (e) => e.evaluatedScore);
      const scoreEntries = _.filter(
        extendedScoreEntries,
        (e): e is PSMAccuracyScoreEntry =>
          typeof e.evaluatedScore !== "undefined"
      );
      const accuracy = getPSMAccuracy(scoreEntries);
      return { scoreType, accuracy, scores };
    });

    const maxAccuracyEntry = _.maxBy(
      accuracyEntries,
      ({ accuracy }) => accuracy
    );
    if (!maxAccuracyEntry) continue;

    const domainAccuracyEntry = {
      domain: domainModel.name,
      maxAccuracyEntry,
      accuracyEntries,
    };
    domainAccuracyEntries.push(domainAccuracyEntry);
  }

  const dedupScoreFunctionGroups = _.values(
    _.groupBy(domainAccuracyEntries, ({ maxAccuracyEntry: { scores } }) =>
      JSON.stringify(scores)
    )
  ).map((group) =>
    group.map(
      ({ domain, maxAccuracyEntry: { scoreType, accuracy, scores } }) => ({
        domain,
        maxAccuracyEntry: { scoreType, accuracy, scores },
      })
    )
  );

  const report = {
    dedupScoreFunctionGroups,
  };

  writeFileSync("output-measure.json", JSON.stringify(report, undefined, 2));

  process.exit(0);
}
