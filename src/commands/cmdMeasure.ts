import _ from "lodash";
import assert from "assert";
import ConfusionMatrix from "../util/ConfusionMatrix";
import { isFailure } from "../util/Completion";
import { getDatasetEntries } from "../data/passwords";
import { getPSMAccuracy, PSMAccuracyScoreEntry } from "../core/psm/PSMAccuracy";
import { getScoreTable } from "../core/psm/ScoreTable";
import { isSameSite } from "../util/site";
import { TRUTH } from "../data/truth";
import { writeFileSync } from "fs";
import {
  detectPSM,
  getScoreCandidateFilteringDetail,
  ScoreCandidateFilteringDetail,
} from "../core/psm/detectPSM";
import {
  AbstractCallType,
  getQPFAbstractResultsFromQPFResults,
} from "../core/psm/QPFAbstractResult";
import { createHash } from "crypto";
import { extractDataPath, makeDataPath } from "../data/path";
import DataArchive from "../data/DataArchive";
import { RegisterPage } from "../models/RegisterPage";
import { Site } from "../models/Site";

type RegisterPageSitesEntry = RegisterPage & {
  sites: Site[];
};

type PSMRegisterPage = {
  registerPage: RegisterPage;
  maxPsfDetail: PSFDetail;
  totalPSFs: number;
  maxPSFAccuracyMaxDelta: number;
  isZxcvbn: boolean;
};

type PSFDetail = {
  scoreType: AbstractCallType;
  signature: string;
  scores: number[];
  accuracy: number;
};

export default function cmdMeasure(args: { analyzeOutDir: string }) {
  const { analyzeOutDir } = args;
  const dataName = extractDataPath(analyzeOutDir);
  const dataArchive = DataArchive.open(makeDataPath(dataName, "data.sqlite"));

  const rpSitesMap = dataArchive.getRegisterPageSitesMap();

  let totalSitesCount = 0;
  let accessedSitesCount = 0;

  for (const siteId of dataArchive.getRegisterPageDetectionResultRecordIds()) {
    totalSitesCount += 1;

    const { result, site, registerPage } =
      dataArchive.getRegisterPageDetectionResultRecord(siteId)!;

    const { searchCompletion } = result;
    assert(searchCompletion);

    // count if completion status is success or the failure error is not a network error
    if (
      !isFailure(searchCompletion) ||
      !searchCompletion.error?.message.includes("Error: page.goto: net::ERR_")
    ) {
      accessedSitesCount += 1;
    }
  }

  let registerPages: RegisterPageSitesEntry[] = [];
  let successfulDetectRegisterPagesCount = 0;
  let successfulAnalysisRegisterPagesCount = 0;
  let psmDetectedRegisterPagesCount: number = 0;
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
  const truthCandidates: RegisterPage[] = [];

  for (const rpId of dataArchive.getPSMAnalysisResultRecordIds()) {
    const { result, registerPage } =
      dataArchive.getPSMAnalysisResultRecord(rpId)!;
    const { url: rpUrl } = registerPage;

    registerPages.push({ ...registerPage, sites: rpSitesMap.get(rpId)! });

    const {
      recordCompletion,
      testCompletion,
      detectCompletion,
      analysisCompletion,
    } = result;

    assert(recordCompletion);
    if (isFailure(recordCompletion)) continue;

    assert(testCompletion);
    if (isFailure(testCompletion)) continue;
    if (!detectCompletion) {
      successfulDetectRegisterPagesCount += 1;
      continue;
    }
    if (isFailure(detectCompletion)) continue;
    successfulDetectRegisterPagesCount += 1;

    const { value: detectQPFResults } = detectCompletion;
    const detectAbstractResult =
      getQPFAbstractResultsFromQPFResults(detectQPFResults);
    const psmDetected = detectPSM(detectAbstractResult);

    truthCandidates.push(registerPage);

    if (TRUTH.has(rpUrl)) {
      const truth = TRUTH.get(rpUrl)!;
      psmConfusionMatrix.addValue(rpUrl, Boolean(psmDetected), truth);
    }

    const filteringDetailLocal =
      getScoreCandidateFilteringDetail(detectAbstractResult);
    for (const key of Object.keys(filteringDetailLocal)) {
      filteringDetail[key] =
        (filteringDetail[key] ?? 0) + filteringDetailLocal[key];
    }

    if (!psmDetected) continue;
    const { scoreTypes } = psmDetected;

    psmDetectedRegisterPagesCount += 1;

    const serverSideScoreType = scoreTypes.find(
      (scoreType) => scoreType.kind === "xhrRequest",
    );
    if (serverSideScoreType) {
      psmDetectedRegisterPagesDetail.serverSide += 1;
      if (!isSameSite(new URL(serverSideScoreType.url), new URL(rpUrl))) {
        psmDetectedRegisterPagesDetail.serverSideCrossSite += 1;
        // console.log("serverSideCrossSite", rpUrl, serverSideScoreType.url);
      }
      if (new URL(serverSideScoreType.url).protocol !== "https:") {
        psmDetectedRegisterPagesDetail.serverSideNonSecure += 1;
      }
    } else {
      assert(
        scoreTypes.every((scoreType) => scoreType.kind === "functionCall"),
      );
      psmDetectedRegisterPagesDetail.clientSide += 1;
      if (
        scoreTypes.some(
          (scoreType) =>
            !isSameSite(new URL(scoreType.sourceLoc[0]), new URL(rpUrl)),
        )
      ) {
        psmDetectedRegisterPagesDetail.clientSideCrossSite += 1;
        // console.log(
        //   "clientSideCrossSite",
        //   rpUrl,
        //   scoreTypes.map((scoreType) => scoreType.sourceLoc[0])
        // );
      }
    }

    assert(analysisCompletion);
    if (isFailure(analysisCompletion)) continue;
    successfulAnalysisRegisterPagesCount += 1; // WARNING! This is not equal to number of register pages in psmClusters

    const { value: analysisQPFResult } = analysisCompletion;
    const analysisAbstractResult =
      getQPFAbstractResultsFromQPFResults(analysisQPFResult);
    const scoreTable = getScoreTable(analysisAbstractResult, scoreTypes);

    const psfDetails = _.uniqBy(
      scoreTypes.map((scoreType): PSFDetail => {
        const scoreTypeIndex = scoreTypes.indexOf(scoreType);
        assert(scoreTypeIndex !== -1);
        const scoreEntries = _.map(
          getDatasetEntries(),
          ([password, frequency], rankIndex): PSMAccuracyScoreEntry => {
            const scoreTableRow = scoreTable.find(
              ({ password: passwordSearched }) => passwordSearched === password,
            );
            assert(scoreTableRow);
            const evaluatedScore =
              scoreTableRow.scores[scoreTypeIndex] ?? -Infinity;
            return { frequency, referenceScore: rankIndex + 1, evaluatedScore };
          },
        );
        const scores = _.map(scoreEntries, (e) => e.evaluatedScore);
        const accuracy = getPSMAccuracy(scoreEntries);
        return {
          scoreType,
          signature: createHash("md5")
            .update(JSON.stringify(scores))
            .digest("hex"),
          scores,
          accuracy: !isNaN(accuracy) ? accuracy : 0, // 0 means "no correlation"
        };
      }),
      ({ signature }) => signature,
    );

    const maxPsfDetail = _.maxBy(psfDetails, ({ accuracy }) => accuracy);
    assert(maxPsfDetail);

    const isZxcvbn = (() => {
      const {
        scoreType: { propertyName },
        scores,
      } = maxPsfDetail;
      return (
        propertyName === "guesses" ||
        propertyName === "guesses_log10" ||
        (propertyName === "score" &&
          scores.every((s) => !Number.isFinite(s) || (s >= 0 && s <= 4)))
      );
    })();

    const psmRegisterPage = <PSMRegisterPage>{
      registerPage,
      sites: rpSitesMap.get(rpId),
      maxPsfDetail,
      totalPSFs: psfDetails.length,
      maxPSFAccuracyMaxDelta: _.max(
        psfDetails.map(({ accuracy }) =>
          Math.abs(maxPsfDetail.accuracy - accuracy),
        ),
      ),
      isZxcvbn,
    };
    psmRegisterPages.push(psmRegisterPage);
  }

  const psmClusters = _.values(
    _.groupBy(psmRegisterPages, ({ maxPsfDetail: { signature } }) => signature),
  );

  // console.log(
  //   "missing register pages for validation of analysis pipeline",
  //   _.difference(
  //     [...TRUTH.keys()],
  //     Object.values(psmConfusionMatrix.get()).flat()
  //   )
  // );

  const report = {
    totalSitesCount,
    accessedSitesCount,
    registerPages,
    successfulDetectRegisterPagesCount,
    successfulAnalysisRegisterPagesCount,
    psmDetectedRegisterPages: psmDetectedRegisterPagesCount,
    psmConfusionMatrix: psmConfusionMatrix.get(),
    psmClusters,
    filteringDetail,
    psmDetectedRegisterPagesDetail,
  };
  writeFileSync(
    makeDataPath(dataName + ".report.json"),
    JSON.stringify(report),
  );

  const truthCandidatesRanking = _.sortBy(truthCandidates, (candidate) =>
    _.min(rpSitesMap.get(candidate.id!)!.map((s) => s.rank)),
  );
  console.log(
    truthCandidatesRanking.slice(0, 100),
    truthCandidatesRanking.slice(-50),
  );

  process.exit(0);
}
