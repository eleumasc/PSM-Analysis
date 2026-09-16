import DataArchive from "../data/DataArchive";
import { extractDataPath, makeDataPath } from "../data/path";
import assert from "assert";
import {
  Completion,
  isFailure,
  isSuccess,
  toCompletion,
} from "../util/Completion";
import execContainer from "../worker/execContainer";
import { makeTaskFromFunction } from "../worker/Task";
import { bomb } from "../util/timeout";
import measureLoadTime from "../core/measureLoadTime";
import useBrowser from "../util/useBrowser";
import installReplayer from "../core/installReplayer";
import _ from "lodash";
import {
  MeasurePerformanceResult,
  PerformanceResult,
} from "../core/PerformanceResult";
import { toArray } from "iter-tools";
import { stdev } from "../util/math";

export const RUN_MLT_TIMEOUT_MS: number = 3 * 60 * 1000; // 3 minutes

export const NUM_SAMPLES: number = 3;

export default async function cmdPerformance(args: { analyzeOutDir: string }) {
  const dataName = extractDataPath(args.analyzeOutDir);
  const dataArchive = DataArchive.open(makeDataPath(dataName, "data.sqlite"));

  const performanceResults: PerformanceResult[] = [];

  const psmResultRecordIds = toArray(
    dataArchive.getPSMAnalysisResultRecordIds(),
  );
  for (const psmResultRecordId of psmResultRecordIds) {
    const psmResultRecord =
      dataArchive.getPSMAnalysisResultRecord(psmResultRecordId);
    assert(psmResultRecord);

    const { registerPage, result } = psmResultRecord;

    const { recordCompletion, analysisCompletion } = result;
    if (!analysisCompletion || !isSuccess(analysisCompletion)) continue;
    assert(recordCompletion && isSuccess(recordCompletion));
    const {
      value: { harFile },
    } = recordCompletion;

    console.log(`begin performance ${registerPage.url}`);

    let performanceResult = dataArchive.getPerformanceResult(registerPage.id!);
    if (performanceResult) {
      performanceResults.push(performanceResult);

      console.log(`(cached) end performance ${registerPage.url}`);
      continue;
    }

    const completion = await toCompletion(async () => {
      let standardLoadTimes: number[] = new Array(NUM_SAMPLES);
      for (const i in _.range(NUM_SAMPLES)) {
        const { loadTime } = await execContainer(
          makeTaskFromFunction(runMeasureLoadTime, [
            {
              rpUrl: registerPage.url,
              replayHarFile: harFile,
            },
          ]),
        );
        standardLoadTimes[i] = loadTime;
        console.log(`standard ${i}: ${loadTime} ms`);
      }

      let analysisLoadTimes: number[] = new Array(NUM_SAMPLES);
      for (const i in _.range(NUM_SAMPLES)) {
        const { loadTime } = await execContainer(
          makeTaskFromFunction(runMeasureLoadTime, [
            {
              rpUrl: registerPage.url,
              replayHarFile: harFile,
              analysisMode: true,
            },
          ]),
        );
        analysisLoadTimes[i] = loadTime;
        console.log(`analysis ${i}: ${loadTime} ms`);
      }

      return <MeasurePerformanceResult>{
        standardLoadTimes,
        analysisLoadTimes,
      };
    });

    performanceResult = { completion };
    dataArchive.completePerformance(registerPage.id!, performanceResult);
    performanceResults.push(performanceResult);

    console.log(`end performance ${registerPage.url}`);
  }

  console.log("Failure", performanceResults.length);
  console.log(
    "Success",
    performanceResults.filter((r) => isSuccess(r.completion)).length,
  );
  console.log(
    "Failure",
    performanceResults.filter((r) => isFailure(r.completion)).length,
  );
  const measurePerformanceResults = performanceResults
    .map((r) => r.completion)
    .filter((completion: Completion<MeasurePerformanceResult>) =>
      isSuccess(completion),
    )
    .map((completion) => completion.value);
  console.log("Samples", measurePerformanceResults.length);
  const overheads = measurePerformanceResults.map(
    (r) => _.mean(r.analysisLoadTimes) / _.mean(r.standardLoadTimes),
  );
  console.log("Overhead (avg)", _.mean(overheads));
  console.log("Overhead (stdev)", stdev(overheads));

  process.exit(0);
}

export async function runMeasureLoadTime(args: {
  rpUrl: string;
  replayHarFile: string;
  analysisMode?: boolean;
}) {
  const { rpUrl, replayHarFile, analysisMode } = args;
  return useBrowser({}, async (page) => {
    const replayHarPath = makeDataPath(replayHarFile);
    await installReplayer(page, replayHarPath, {
      analysisMode,
      routeFromHar: true,
    });
    return bomb(() => measureLoadTime(page, { rpUrl }), RUN_MLT_TIMEOUT_MS);
  });
}
