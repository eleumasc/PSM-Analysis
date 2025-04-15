import _ from "lodash";
import assert from "assert";
import ConfusionMatrix from "../util/ConfusionMatrix";
import toSimplifiedURL from "../util/toSimplifiedURL";
import { Completion, isFailure } from "../util/Completion";
import { getPSMAccuracy, PSMAccuracyScoreEntry } from "../core/psm/PSMAccuracy";
import { getScoreTable } from "../core/psm/ScoreTable";
import { InputPasswordFieldResult } from "../core/InputPasswordFieldResult";
import { openDoCo } from "../core/DoCo";
import { ROCKYOU2021_PASSWORDS_ROWS } from "../data/rockyou2021";
import { SearchRegisterPageResult } from "../core/searchRegisterPage";
import { TRUTH } from "../data/truth";
import { writeFileSync } from "fs";
import {
  detectPSM,
  getScoreCandidateFilteringDetail,
  ScoreCandidateFilteringDetail,
} from "../core/psm/detectPSM";
import {
  CHUNKS_COLLECTION_NAME,
  PSM_ANALYSIS_COLLECTION_TYPE,
  PSMAnalysisResult,
} from "./cmdAnalyze";
import {
  AbstractCallType,
  FunctionCallAbstractCallType,
  getIPFAbstractResultFromIPFResult,
} from "../core/psm/InputPasswordFieldAbstractResult";

type SiteDetail = {
  name: string;
  rank: number;
};

type RegisterPage = {
  registerPageKey: string;
  sites: SiteDetail[];
};

type PSMRegisterPage = RegisterPage & {
  maxAccuracyPsfDetail: PSFDetail;
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
  const sitesArray = dc.getDocumentData(
    dc.getCollectionById(registrationPagesCollection.parentId!).id
  ) as string[];

  // Register Pages

  let accessedSitesCount = 0;
  const registerPageSitesMap = new Map<string, SiteDetail[]>();

  for (const { id: documentId, name: siteName } of dc.getDocumentsByCollection(
    registrationPagesCollection.id
  )) {
    const site: SiteDetail = {
      name: siteName,
      rank: sitesArray.indexOf(siteName),
    };

    const completion = dc.getDocumentData(
      documentId
    ) as Completion<SearchRegisterPageResult>;

    if (isFailure(completion)) continue;
    accessedSitesCount += 1;

    const {
      value: { registerPageUrl },
    } = completion;
    if (registerPageUrl === null) continue;

    const registerPageKey = toSimplifiedURL(registerPageUrl).toString();
    registerPageSitesMap.set(registerPageKey, [
      ...(registerPageSitesMap.get(registerPageKey) ?? []),
      site,
    ]);
  }

  const registerPages = [...registerPageSitesMap.entries()].map(
    ([registerPageKey, sites]): RegisterPage => ({ registerPageKey, sites })
  );

  // PSM Analysis

  let successfulDetectRegisterPagesCount = 0;
  let successfulAnalysisRegisterPagesCount = 0;
  let psmRegisterPagesCount = 0;
  let psmClientSideRegisterPagesCount = 0;
  let psmClientSideCrossOriginRegisterPagesCount = 0;
  let psmServerSideRegisterPagesCount = 0;
  let psmServerSideCrossOriginRegisterPagesCount = 0;
  let psmServerSideInsecureRegisterPagesCount = 0;
  const psmConfusionMatrix = new ConfusionMatrix<string>();
  const psmRegisterPages: PSMRegisterPage[] = [];
  const filteringDetail: ScoreCandidateFilteringDetail = {};

  for (const {
    id: documentId,
    name: registerPageKey,
  } of dc.getDocumentsByCollection(psmAnalysisCollection.id)) {
    const psmAnalysisResult = dc.getDocumentData(
      documentId
    ) as PSMAnalysisResult;

    const { testCompletion, detectCompletion, analysisCompletion } =
      psmAnalysisResult;

    assert(testCompletion);
    if (isFailure(testCompletion)) continue;
    if (!detectCompletion) {
      successfulDetectRegisterPagesCount += 1;
      continue;
    }
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
      psmConfusionMatrix.addValue(registerPageKey, Boolean(psmDetected), truth);
    }

    const filteringDetailLocal =
      getScoreCandidateFilteringDetail(detectAbstractResult);
    for (const key of Object.keys(filteringDetailLocal)) {
      filteringDetail[key] =
        (filteringDetail[key] ?? 0) + filteringDetailLocal[key];
    }

    if (!psmDetected) continue;
    const { scoreTypes } = psmDetected;
    psmRegisterPagesCount += 1;
    const serverSideScoreType = scoreTypes.find(
      (scoreType) => scoreType.kind === "xhrRequest"
    );
    if (serverSideScoreType) {
      psmServerSideRegisterPagesCount += 1;
      if (
        new URL(serverSideScoreType.url).origin !==
        new URL(registerPageKey).origin
      ) {
        psmServerSideCrossOriginRegisterPagesCount += 1;
      }
      if (new URL(serverSideScoreType.url).protocol !== "https:") {
        psmServerSideInsecureRegisterPagesCount += 1;
      }
    } else {
      psmClientSideRegisterPagesCount += 1;
      if (
        (scoreTypes as FunctionCallAbstractCallType[]).some(
          (scoreType) =>
            new URL(scoreType.sourceLoc[0]).origin !==
            new URL(registerPageKey).origin
        )
      ) {
        psmClientSideCrossOriginRegisterPagesCount += 1;
      }
    }

    assert(analysisCompletion);
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

    const psmRegisterPage = <PSMRegisterPage>{
      registerPageKey,
      sites: registerPageSitesMap.get(registerPageKey),
      maxAccuracyPsfDetail,
    };
    psmRegisterPages.push(psmRegisterPage);
  }

  const psmClusters = _.values(
    _.groupBy(psmRegisterPages, ({ maxAccuracyPsfDetail: { scores } }) =>
      JSON.stringify(scores)
    )
  );

  // // missing reg. pages for heuristics evaluation
  // console.log(
  //   _.difference(
  //     [...TRUTH.keys()],
  //     Object.values(psmConfusionMatrix.get()).flat()
  //   )
  // );

  const report = {
    accessedSitesCount,
    registerPages,
    successfulDetectRegisterPagesCount,
    successfulAnalysisRegisterPagesCount,
    filteringDetail,
    psmRegisterPagesCount,
    psmClientSideRegisterPagesCount,
    psmClientSideCrossOriginRegisterPagesCount,
    psmServerSideRegisterPagesCount,
    psmServerSideCrossOriginRegisterPagesCount,
    psmServerSideInsecureRegisterPagesCount,
    psmConfusionMatrix: psmConfusionMatrix.get(),
    psmClusters,
  };
  writeFileSync("report.json", JSON.stringify(report));

  process.exit(0);
}
