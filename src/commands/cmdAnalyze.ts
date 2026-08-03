import _ from "lodash";
import buckets from "../util/buckets";
import currentTime from "../util/currentTime";
import installAnalysis from "../core/installAnalysis";
import useBrowser from "../util/useBrowser";
import { bomb } from "../util/timeout";
import { detectPSM } from "../core/psm/detectPSM";
import { getQPFAbstractResultsFromQPFResults } from "../core/psm/QPFAbstractResult";
import { QPFResultArray } from "../core/QPFResult";
import { mayDetectPSM } from "../core/psm/mayDetectPSM";
import { processTaskQueue } from "../util/TaskQueue";
import { isSuccess, Success, toCompletion } from "../util/Completion";
import {
  getDatasetPasswords,
  getMonotoneTestPasswords,
  getTestPassword,
} from "../data/passwords";
import queryPasswordField, { QPFHint } from "../core/queryPasswordField";
import { extractDataPath, makeDataPath } from "../data/path";
import { mkdirSync } from "fs";
import DataArchive from "../data/DataArchive";
import { readSiteList } from "../data/readSiteList";
import { enumerate, toArray } from "iter-tools";
import searchRegisterPage, {
  SearchRegisterPageResult,
} from "../core/searchRegisterPage";
import { RegisterPage } from "../models/RegisterPage";
import { makeTaskFromFunction } from "../worker/Task";
import path from "path";
import execContainer from "../worker/execContainer";
import assert from "assert";
import { Site } from "../models/Site";
import { encodeUrlAsFilenameHash } from "../util/encodeAsFilename";
import { RegisterPageDetectionResult } from "../core/RegisterPageDetectionResult";
import { PSMAnalysisResult } from "../core/PSMAnalysisResult";
import zigzag from "../util/zigzag";

const RUN_SRP_TIMEOUT_MS: number = 5 * 60 * 1000; // 5 minutes

const RUN_QPF_TIMEOUT_MS: number = 10 * 60 * 1000; // 10 minutes

const RUN_QPF_ANALYSIS_BUCKET_SIZE: number = 50;

export default async function cmdAnalyze(
  args: (
    | {
        action: "create";
        siteListPath: string;
      }
    | {
        action: "resume";
        analyzeOutDir: string;
      }
  ) & {
    maxTasks: number;
    rpdOnly: boolean;
  }
) {
  const { dataName, dataArchive } = (() => {
    if (args.action === "create") {
      const { siteListPath } = args;
      const siteListDataName = extractDataPath(siteListPath);
      const dataName = `${currentTime()}-Analyze`;
      mkdirSync(makeDataPath(dataName), { recursive: true });
      const dataArchive = DataArchive.open(
        makeDataPath(dataName, "data.sqlite")
      );
      dataArchive.addSites(readSiteList(makeDataPath(siteListDataName)));
      return { dataName, dataArchive };
    } else {
      const { analyzeOutDir } = args;
      const dataName = extractDataPath(analyzeOutDir);
      const dataArchive = DataArchive.open(
        makeDataPath(dataName, "data.sqlite")
      );
      return { dataName, dataArchive };
    }
  })();

  console.log(`Name: ${dataName}`);

  const abortController = new AbortController();
  process.addListener("SIGINT", () => {
    abortController.abort();
  });
  const abortSignal = abortController.signal;

  const pendingSites = toArray(
    dataArchive.getPendingSitesForRegisterPageDetection()
  );
  console.log(
    `Register Page Detection: ${pendingSites.length} sites remaining`
  );
  await processTaskQueue(
    pendingSites,
    {
      maxTasks: args.maxTasks,
      abortSignal,
    },
    (site, queueIndex) => async () => {
      const { name: siteName } = site;
      console.log(`begin ${siteName} [${queueIndex}]`);
      try {
        const result = await phaseRegisterPageDetection(site, dataName);
        dataArchive.completeRegisterPageDetection(site.id!, result);
      } catch (e) {
        console.log(`error ${e}`);
      } finally {
        console.log(`end ${siteName} [${queueIndex}]`);
      }
    }
  );

  if (abortSignal.aborted || args.rpdOnly) {
    process.exit(0);
  }

  const pendingRegisterPages = toArray(
    dataArchive.getPendingRegisterPagesForPSMAnalysis()
  );
  console.log(
    `PSM Analysis: ${pendingRegisterPages.length} register pages remaining`
  );
  await processTaskQueue(
    pendingRegisterPages,
    {
      maxTasks: args.maxTasks,
      abortSignal,
    },
    (registerPage, queueIndex) => async () => {
      const { url: rpUrl } = registerPage;
      console.log(`begin ${rpUrl} [${queueIndex}]`);
      try {
        const result = await phasePSMAnalysis(registerPage, dataName);
        dataArchive.completePSMAnalysis(registerPage.id!, result);
      } catch (e) {
        console.log(`error ${e}`);
      } finally {
        console.log(`end ${rpUrl} [${queueIndex}]`);
      }
    }
  );

  process.exit(0);
}

async function phaseRegisterPageDetection(
  site: Site,
  dataName: string
): Promise<RegisterPageDetectionResult> {
  const { name: siteName } = site;
  let result: RegisterPageDetectionResult = {};

  const searchCompletion = await toCompletion(() =>
    execContainer(
      makeTaskFromFunction(runSearchRegisterPage, [{ site: siteName }])
    )
  );
  result = { ...result, searchCompletion };

  return result;
}

async function phasePSMAnalysis(
  registerPage: RegisterPage,
  dataName: string
): Promise<PSMAnalysisResult> {
  const { url: rpUrl } = registerPage;
  const harFile = path.join(
    dataName,
    encodeUrlAsFilenameHash(registerPage.url) + ".har.zip"
  );
  let result: PSMAnalysisResult = {};

  console.log(`record ${rpUrl}`);
  const recordCompletion = await toCompletion(() =>
    execContainer(
      makeTaskFromFunction(runQueryPasswordField, [
        {
          rpUrl,
          passwordArray: [getTestPassword()],
          recordHarFile: harFile,
        },
      ])
    )
  );
  if (!isSuccess(recordCompletion)) {
    return { ...result, recordCompletion };
  }
  result = {
    ...result,
    recordCompletion: Success({ harFile }),
  };

  console.log(`test ${rpUrl}`);
  const testCompletion = await toCompletion(() =>
    execContainer(
      makeTaskFromFunction(runQueryPasswordField, [
        {
          rpUrl,
          passwordArray: [getTestPassword()],
          replayHarFile: harFile,
        },
      ])
    )
  );
  result = { ...result, testCompletion };
  if (!isSuccess(testCompletion)) {
    return result;
  }

  const { value: testQPFResults } = testCompletion;
  const qpfHint = mayDetectPSM(
    getQPFAbstractResultsFromQPFResults(testQPFResults)
  );
  if (!qpfHint) {
    return result;
  }

  console.log(`detect ${rpUrl}`);
  const detectCompletion = await toCompletion(() =>
    execContainer(
      makeTaskFromFunction(runQueryPasswordField, [
        {
          rpUrl,
          passwordArray: zigzag(getMonotoneTestPasswords()), // zigzag() is meant to prevent correlations between password strength and time
          hint: qpfHint,
          replayHarFile: harFile,
        },
      ])
    )
  );
  result = { ...result, detectCompletion };
  if (!isSuccess(detectCompletion)) {
    return result;
  }
  result = {
    ...result,
    detectCompletion: Success(zigzag(detectCompletion.value)), // invert zigzag()
  };

  const { value: detectQPFResults } = detectCompletion;
  const psmDetected = detectPSM(
    getQPFAbstractResultsFromQPFResults(detectQPFResults)
  );
  if (!psmDetected) {
    return result;
  }

  let analysisQPFResults: QPFResultArray = [];
  for (const [seq, bucket] of enumerate(
    buckets(getDatasetPasswords(), RUN_QPF_ANALYSIS_BUCKET_SIZE)
  )) {
    console.log(`analysis ${seq} ${rpUrl}`);
    const partialAnalysisCompletion = await toCompletion(() =>
      execContainer(
        makeTaskFromFunction(runQueryPasswordField, [
          {
            rpUrl,
            passwordArray: bucket,
            hint: qpfHint,
            replayHarFile: harFile,
          },
        ])
      )
    );
    if (!isSuccess(partialAnalysisCompletion)) {
      return { ...result, analysisCompletion: partialAnalysisCompletion };
    }
    const { value: partialAnalysisQPFResults } = partialAnalysisCompletion;
    analysisQPFResults = [...analysisQPFResults, ...partialAnalysisQPFResults];
  }
  const analysisCompletion = Success(analysisQPFResults);
  result = { ...result, analysisCompletion };

  return result;
}

export async function runSearchRegisterPage(args: {
  site: string;
}): Promise<SearchRegisterPageResult> {
  const { site } = args;
  return useBrowser({}, async (page) =>
    bomb(() => searchRegisterPage(page, site), RUN_SRP_TIMEOUT_MS)
  );
}

export function runQueryPasswordField(args: {
  rpUrl: string;
  passwordArray: string[];
  hint?: QPFHint;
  recordHarFile?: string;
  replayHarFile?: string;
}): Promise<QPFResultArray> {
  const { rpUrl, passwordArray, hint, recordHarFile, replayHarFile } = args;
  assert(Boolean(recordHarFile) !== Boolean(replayHarFile));
  let recordHarPath: string | undefined;
  if (recordHarFile) {
    recordHarPath = makeDataPath(recordHarFile);
  }
  return useBrowser({ recordHarPath }, async (page) => {
    if (replayHarFile) {
      const replayHarPath = makeDataPath(replayHarFile);
      await installAnalysis(page, replayHarPath);
    }
    return bomb(
      () =>
        queryPasswordField(page, {
          rpUrl,
          passwordArray,
          hint,
          isSimulating: Boolean(recordHarFile),
        }),
      RUN_QPF_TIMEOUT_MS
    );
  });
}
