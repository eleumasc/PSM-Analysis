import _ from "lodash";
import assert from "assert";
import ConfusionMatrix from "../util/ConfusionMatrix";
import toSimplifiedURL from "../util/toSimplifiedURL";
import { Completion, isFailure } from "../util/Completion";
import { detectPSM, getDetectPSMFilteringDetail } from "../core/psm/detectPSM";
import { getPSMAccuracy, PSMAccuracyScoreEntry } from "../core/psm/PSMAccuracy";
import { getScoreTable } from "../core/psm/ScoreTable";
import { InputPasswordFieldResult } from "../core/InputPasswordFieldResult";
import { openDoCo } from "../core/DoCo";
import { ROCKYOU2021_PASSWORDS_ROWS } from "../data/rockyou2021";
import { SearchRegisterPageResult } from "../core/searchRegisterPage";
import { TRUTH } from "../data/truth";
import { writeFileSync } from "fs";
import {
  CHUNKS_COLLECTION_NAME,
  PSM_ANALYSIS_COLLECTION_TYPE,
  PSMAnalysisResult,
} from "./cmdAnalyze";
import {
  AbstractCallType,
  getIPFAbstractResultFromIPFResult,
} from "../core/psm/InputPasswordFieldAbstractResult";

type PSMRegisterPage = {
  registerPageKey: string;
  sites: string[];
  maxAccuracyPsfDetail: PSFDetail;
  hasServerSidePsf: boolean;
};

type PSFDetail = {
  scoreType: AbstractCallType;
  scores: number[];
  accuracy: number;
};

export default function cmdMeasure(args: {
  psmAnalysisId: number;
  dbFilepath: string | undefined;
}) {
  const dc = openDoCo(args.dbFilepath);

  const psmAnalysisCollection = dc.getCollectionById(args.psmAnalysisId);
  assert(psmAnalysisCollection, PSM_ANALYSIS_COLLECTION_TYPE);
  const chunksCollection = dc.getCollectionByName(
    psmAnalysisCollection.id,
    CHUNKS_COLLECTION_NAME
  );
  const registrationPagesCollection = dc.getCollectionById(
    psmAnalysisCollection.parentId!
  );

  // Register Pages

  let accessedSitesCount = 0;
  let registerPagesSitesCount = 0;
  let registerPagesCount = 0;

  const registerPageSitesMap = new Map<string, string[]>();

  for (const { id: documentId, name: site } of dc.getDocumentsByCollection(
    registrationPagesCollection.id
  )) {
    const completion = dc.getDocumentData(
      documentId
    ) as Completion<SearchRegisterPageResult>;

    if (isFailure(completion)) continue;
    accessedSitesCount += 1;

    const {
      value: { registerPageUrl },
    } = completion;
    if (registerPageUrl === null) continue;
    registerPagesSitesCount += 1;

    {
      const registerPageKey = toSimplifiedURL(registerPageUrl).toString();
      registerPageSitesMap.set(registerPageKey, [
        ...(registerPageSitesMap.get(registerPageKey) ?? []),
        site,
      ]);
    }
    registerPagesCount = registerPageSitesMap.size;
  }

  // PSM Analysis

  let successfulDetectRegisterPagesCount = 0;
  let successfulAnalysisRegisterPagesCount = 0;
  let psmDetectedRegisterPagesCount = 0;
  let psmDetectedSitesCount = 0;
  const psmDetectedSites: string[] = [];
  const psmDetectedConfusionMatrix = new ConfusionMatrix<string>();
  const psmRegisterPages: PSMRegisterPage[] = [];
  let filteredConstantFunctionsCount = 0;
  let filteredLengthFunctionsCount = 0;
  let filteredCharacterCountFunctionsCount = 0;
  let filteredNotMonotoneFunctionsCount = 0;

  for (const {
    id: documentId,
    name: registerPageKey,
  } of dc.getDocumentsByCollection(psmAnalysisCollection.id)) {
    const psmAnalysisResult = dc.getDocumentData(
      documentId
    ) as PSMAnalysisResult;

    const { detectCompletion, analysisCompletion } = psmAnalysisResult;

    if (!detectCompletion) continue;
    if (isFailure(detectCompletion)) continue;
    successfulDetectRegisterPagesCount += 1;

    const detectIpfResult = dc.getDocumentData(
      dc.getDocumentByName(chunksCollection.id, detectCompletion.value.chunkKey)
        .id
    ) as InputPasswordFieldResult;
    const detectAbstractResult =
      getIPFAbstractResultFromIPFResult(detectIpfResult);
    const psmDetected = detectPSM(detectAbstractResult);

    if (TRUTH.has(registerPageKey)) {
      const truth = TRUTH.get(registerPageKey)!;
      psmDetectedConfusionMatrix.addValue(
        registerPageKey,
        Boolean(psmDetected),
        truth
      );
    }

    const filteringDetail = getDetectPSMFilteringDetail(detectAbstractResult);
    filteredConstantFunctionsCount += filteringDetail.constantFunctionsCount;
    filteredLengthFunctionsCount += filteringDetail.lengthFunctionsCount;
    filteredCharacterCountFunctionsCount +=
      filteringDetail.characterCountFunctionsCount;
    filteredNotMonotoneFunctionsCount +=
      filteringDetail.notMonotoneFunctionsCount;

    if (!psmDetected) continue;
    psmDetectedRegisterPagesCount += 1;
    psmDetectedSitesCount += registerPageSitesMap.get(registerPageKey)!.length;
    psmDetectedSites.push(...registerPageSitesMap.get(registerPageKey)!);

    if (!analysisCompletion) continue;
    if (isFailure(analysisCompletion)) continue;
    successfulAnalysisRegisterPagesCount += 1;

    const analysisIpfResult = analysisCompletion.value.chunkKeys.flatMap(
      (chunkKey) =>
        dc.getDocumentData(
          dc.getDocumentByName(chunksCollection.id, chunkKey).id
        ) as InputPasswordFieldResult
    );
    const analysisAbstractResult =
      getIPFAbstractResultFromIPFResult(analysisIpfResult);
    const { scoreTypes } = psmDetected;
    const scoreTable = getScoreTable(analysisAbstractResult, scoreTypes);

    const psfDetails = _.map(scoreTypes, (scoreType): PSFDetail => {
      const scoreTypeIndex = scoreTypes.indexOf(scoreType);
      assert(scoreTypeIndex !== -1);
      const scoreEntries = _.map(
        ROCKYOU2021_PASSWORDS_ROWS,
        ([password, frequency], rankIndex): PSMAccuracyScoreEntry => {
          const scoreTableRow = scoreTable.find(
            ({ password: passwordSearched }) => passwordSearched === password
          );
          assert(scoreTableRow);
          const evaluatedScore =
            scoreTableRow.scores[scoreTypeIndex] ?? -Infinity;
          return { frequency, referenceScore: rankIndex + 1, evaluatedScore };
        }
      );
      const scores = _.map(scoreEntries, (e) => e.evaluatedScore);
      const accuracy = getPSMAccuracy(scoreEntries);
      return { scoreType, scores, accuracy };
    });

    const maxAccuracyPsfDetail = _.maxBy(
      psfDetails,
      ({ accuracy }) => accuracy
    );
    if (!maxAccuracyPsfDetail) continue;

    const hasServerSidePsf = psfDetails.some(
      (psfDetail) => psfDetail.scoreType.kind === "xhrRequest"
    );

    const psmRegisterPage = <PSMRegisterPage>{
      registerPageKey,
      sites: registerPageSitesMap.get(registerPageKey),
      maxAccuracyPsfDetail,
      hasServerSidePsf,
    };
    psmRegisterPages.push(psmRegisterPage);
  }

  const psmClusters = _.values(
    _.groupBy(psmRegisterPages, ({ maxAccuracyPsfDetail: { scores } }) =>
      JSON.stringify(scores)
    )
  );

  const report = {
    accessedSitesCount,
    registerPagesSitesCount,
    registerPagesCount,
    successfulDetectRegisterPagesCount,
    successfulAnalysisRegisterPagesCount,
    filteredConstantFunctionsCount,
    filteredLengthFunctionsCount,
    filteredCharacterCountFunctionsCount,
    filteredNotMonotoneFunctionsCount,
    psmDetectedRegisterPagesCount,
    psmDetectedSitesCount,
    psmDetectedSites,
    psmDetectedConfusionMatrix: psmDetectedConfusionMatrix.get(),
    psmClusters,
  };
  writeFileSync("report.json", JSON.stringify(report));

  process.exit(0);
}
