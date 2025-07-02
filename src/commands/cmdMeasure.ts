import _ from "lodash";
import assert from "assert";
import ConfusionMatrix from "../util/ConfusionMatrix";
import openDocumentStore from "../core/openDocumentStore";
import toSimplifiedURL from "../util/toSimplifiedURL";
import { Completion, isFailure } from "../util/Completion";
import { getDatasetEntries } from "../data/passwords";
import { getPSMAccuracy, PSMAccuracyScoreEntry } from "../core/psm/PSMAccuracy";
import { getScoreTable } from "../core/psm/ScoreTable";
import { InputPasswordFieldResult } from "../core/InputPasswordFieldResult";
import { isSameSite } from "../util/site";
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
  const store = openDocumentStore(args.dbFilepath);

  const psmAnalysisCollection = store.getCollectionById(args.psmAnalysisId);
  assert(psmAnalysisCollection, PSM_ANALYSIS_COLLECTION_TYPE);
  const chunksCollection = store.getCollectionByName(
    psmAnalysisCollection.id,
    CHUNKS_COLLECTION_NAME
  );
  const registrationPagesCollection = store.getCollectionById(
    psmAnalysisCollection.parentId!
  );
  const sitesArray = store.getDocumentData(
    store.getCollectionById(registrationPagesCollection.parentId!).id
  ) as string[];

  // Register Pages

  let accessedSitesCount = 0;
  const registerPageSitesMap = new Map<string, SiteDetail[]>();

  for (const {
    id: documentId,
    name: siteName,
  } of store.getDocumentsByCollection(registrationPagesCollection.id)) {
    const site: SiteDetail = {
      name: siteName,
      rank: sitesArray.indexOf(siteName),
    };

    const completion = store.getDocumentData(
      documentId
    ) as Completion<SearchRegisterPageResult>;

    // count if completion status is success or the failure error is not a network error
    if (
      !isFailure(completion) ||
      !completion.error?.message.includes("Error: page.goto: net::ERR_")
    ) {
      accessedSitesCount += 1;
    }

    if (isFailure(completion)) continue;

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
  const registerPagesMap = new Map(
    registerPages.map((registerPage) => [
      registerPage.registerPageKey,
      registerPage,
    ])
  );

  // PSM Analysis

  let successfulDetectRegisterPagesCount = 0;
  let successfulAnalysisRegisterPagesCount = 0;
  const psmDetectedRegisterPages: RegisterPage[] = [];
  const psmConfusionMatrix = new ConfusionMatrix<string>();
  const psmRegisterPages: PSMRegisterPage[] = [];
  const filteringDetail: ScoreCandidateFilteringDetail = {};
  const psmDetectedRegisterPagesDetail = {
    clientSide: 0,
    clientSideCrossSite: 0,
    serverSide: 0,
    serverSideCrossSite: 0,
    serverSideNonSecure: 0,
  };

  for (const {
    id: documentId,
    name: registerPageKey,
  } of store.getDocumentsByCollection(psmAnalysisCollection.id)) {
    const psmAnalysisResult = store.getDocumentData(
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

    const detectIpfResult = store.getDocumentData(
      store.getDocumentByName(
        chunksCollection.id,
        detectCompletion.value.chunkKey
      ).id
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
    psmDetectedRegisterPages.push(registerPagesMap.get(registerPageKey)!);
    const serverSideScoreType = scoreTypes.find(
      (scoreType) => scoreType.kind === "xhrRequest"
    );
    if (serverSideScoreType) {
      psmDetectedRegisterPagesDetail.serverSide += 1;
      if (
        !isSameSite(new URL(serverSideScoreType.url), new URL(registerPageKey))
      ) {
        psmDetectedRegisterPagesDetail.serverSideCrossSite += 1;
        // console.log("serverSideCrossSite", registerPageKey, serverSideScoreType.url);
      }
      if (new URL(serverSideScoreType.url).protocol !== "https:") {
        psmDetectedRegisterPagesDetail.serverSideNonSecure += 1;
      }
    } else {
      assert(
        scoreTypes.every((scoreType) => scoreType.kind === "functionCall")
      );
      psmDetectedRegisterPagesDetail.clientSide += 1;
      if (
        scoreTypes.some(
          (scoreType) =>
            !isSameSite(
              new URL(scoreType.sourceLoc[0]),
              new URL(registerPageKey)
            )
        )
      ) {
        psmDetectedRegisterPagesDetail.clientSideCrossSite += 1;
        // console.log(
        //   "clientSideCrossSite",
        //   registerPageKey,
        //   scoreTypes.map((scoreType) => scoreType.sourceLoc[0])
        // );
      }
    }

    assert(analysisCompletion);
    if (isFailure(analysisCompletion)) continue;
    successfulAnalysisRegisterPagesCount += 1;

    const analysisIpfResult = analysisCompletion.value.chunkKeys.flatMap(
      (chunkKey) =>
        store.getDocumentData(
          store.getDocumentByName(chunksCollection.id, chunkKey).id
        ) as InputPasswordFieldResult
    );
    const analysisAbstractResult =
      getIPFAbstractResultFromIPFResult(analysisIpfResult);
    const scoreTable = getScoreTable(analysisAbstractResult, scoreTypes);

    const psfDetails = _.map(scoreTypes, (scoreType): PSFDetail => {
      const scoreTypeIndex = scoreTypes.indexOf(scoreType);
      assert(scoreTypeIndex !== -1);
      const scoreEntries = _.map(
        getDatasetEntries(),
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

  // console.log(
  //  "missing register pages for validation of analysis pipeline",
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
    psmDetectedRegisterPages,
    psmConfusionMatrix: psmConfusionMatrix.get(),
    psmClusters,
    filteringDetail,
    psmDetectedRegisterPagesDetail,
  };
  writeFileSync("report.json", JSON.stringify(report));

  process.exit(0);
}
