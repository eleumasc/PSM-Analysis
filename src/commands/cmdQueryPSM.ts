import currentTime from "../util/currentTime";
import DataAccessObject, { DomainModel, Rowid } from "../core/DataAccessObject";
import inputPasswordField from "../core/inputPasswordField";
import installAnalysis from "../core/installAnalysis";
import processDomainTaskQueue from "../util/processDomainTaskQueue";
import useBrowser from "../util/useBrowser";
import useWorker from "../core/worker";
import { detectPSM } from "../core/detection/detectPSM";
import { getIPFAbstractResultFromIPFResult } from "../core/detection/InputPasswordFieldAbstractResult";
import { getRockYou2021Passwords } from "../data/passwords";
import { INPUT_PASSWORD_FIELD_ANALYSIS_TYPE } from "./cmdInputPasswordField";
import { InputPasswordFieldResult } from "../core/InputPasswordFieldResult";
import { SearchSignupPageResult } from "../core/searchSignupPage";
import {
  Completion,
  Failure,
  isFailure,
  toCompletion,
} from "../util/Completion";

export const QUERY_PSM_ANALYSIS_TYPE = "psm_query";

export default async function cmdQueryPSM(
  args: (
    | {
        action: "create";
        parentAnalysisId: number;
      }
    | {
        action: "resume";
        analysisId: number;
      }
  ) & {
    maxTasks: number;
    maxInstrumentWorkers: number;
    maxInstrumentWorkerMemory?: number;
  }
) {
  const dao = DataAccessObject.open();

  const analysisId =
    args.action === "create"
      ? dao.createSubAnalysis(
          QUERY_PSM_ANALYSIS_TYPE,
          args.parentAnalysisId,
          INPUT_PASSWORD_FIELD_ANALYSIS_TYPE
        )
      : args.analysisId;
  const todoDomains = dao.getTodoDomains(analysisId, QUERY_PSM_ANALYSIS_TYPE);

  console.log(`Analysis ID: ${analysisId}`);
  console.log(`${todoDomains.length} domains remaining`);

  await processDomainTaskQueue(
    todoDomains,
    { maxTasks: args.maxTasks },
    (domainModel) => () =>
      runQueryPSM(
        analysisId,
        domainModel,
        args.maxInstrumentWorkers,
        args.maxInstrumentWorkerMemory
      )
  );

  process.exit(0);
}

export async function runQueryPSM(
  analysisId: Rowid,
  domainModel: DomainModel,
  maxWorkers: number,
  maxWorkerMemory: number | undefined
) {
  const dao = DataAccessObject.open();

  const { id: domainId, rank: domainRank, name: domainName } = domainModel;

  const ipfAnalysisId = dao.getAnalysis(analysisId).parentAnalysisId!;
  const ipfCompletion = dao.getAnalysisResult(
    dao.getAnalysis(analysisId).parentAnalysisId!,
    domainId
  ) as Completion<InputPasswordFieldResult>;
  if (isFailure(ipfCompletion)) {
    dao.createAnalysisResult(analysisId, domainId, Failure());
    return;
  }
  const { value: ipfResult } = ipfCompletion;
  const psmDetected = detectPSM(getIPFAbstractResultFromIPFResult(ipfResult));
  if (!psmDetected) {
    dao.createAnalysisResult(analysisId, domainId, Failure());
    return;
  }

  const spsAnalysisId = dao.getAnalysis(ipfAnalysisId).parentAnalysisId!;
  const spsCompletion = dao.getAnalysisResult(
    spsAnalysisId,
    domainId
  ) as Completion<SearchSignupPageResult>;
  if (isFailure(spsCompletion)) {
    dao.createAnalysisResult(analysisId, domainId, Failure());
    return;
  }
  const {
    value: { signupPageUrl },
  } = spsCompletion;
  if (signupPageUrl === null) {
    dao.createAnalysisResult(analysisId, domainId, Failure());
    return;
  }

  console.log(`begin analysis ${domainName} [${domainRank}]`);
  const startTime = currentTime();
  const completion = await toCompletion(() =>
    useWorker(
      {
        maxWorkers,
        maxWorkerMemory,
      },
      async (workerExec) => {
        const runAnalysis = (passwordList: string[]) =>
          useBrowser(async (browser) => {
            const page = await browser.newPage();
            await installAnalysis(page, { workerExec });
            return inputPasswordField(
              page,
              domainName,
              signupPageUrl,
              passwordList
            );
          });

        return runAnalysis(getRockYou2021Passwords());
      }
    )
  );
  const endTime = currentTime();
  console.log(`end analysis ${domainName} [${domainRank}]`);

  const timeInfo = { startTime, endTime };
  dao.createAnalysisResult(analysisId, domainId, completion, timeInfo);
}
