import currentTime from "../util/currentTime";
import DataAccessObject, { DomainModel, Rowid } from "../core/DataAccessObject";
import filterTestDomain from "../util/filterTestDomain";
import inputPasswordField from "../core/inputPasswordField";
import installAnalysis from "../core/installAnalysis";
import processDomainTaskQueue from "../util/processDomainTaskQueue";
import useBrowser from "../util/useBrowser";
import useWorker from "../core/worker";
import { bomb } from "../util/timeout";
import { getDetectPSMPasswords, PROBE_PASSWORD } from "../data/passwords";
import { getIPFAbstractResultFromIPFResult } from "../core/detection/InputPasswordFieldAbstractResult";
import { mayDetectPSM } from "../core/detection/mayDetectPSM";
import { SEARCH_SIGNUP_PAGE_ANALYSIS_TYPE } from "./cmdSearchSignupPage";
import { SearchSignupPageResult } from "../core/searchSignupPage";
import {
  Completion,
  Failure,
  isFailure,
  toCompletion,
} from "../util/Completion";

export const PROBE_PSM_ANALYSIS_TYPE = "probe_psm";

const ANALYSIS_TIMEOUT_MS: number = 10 * 60 * 1000; // 10 minutes

export default async function cmdProbePSM(
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
    testDomainName?: string;
  }
) {
  const dao = DataAccessObject.open();

  const analysisId =
    args.action === "create"
      ? dao.createSubAnalysis(
          PROBE_PSM_ANALYSIS_TYPE,
          args.parentAnalysisId,
          SEARCH_SIGNUP_PAGE_ANALYSIS_TYPE
        )
      : args.analysisId;
  const todoDomains = filterTestDomain(
    args.testDomainName,
    dao.getTodoDomains(analysisId, PROBE_PSM_ANALYSIS_TYPE)
  );

  console.log(`Analysis ID: ${analysisId}`);
  console.log(`${todoDomains.length} domains remaining`);

  await processDomainTaskQueue(
    todoDomains,
    { maxTasks: args.maxTasks },
    (domainModel) => () =>
      runProbePSM(
        analysisId,
        domainModel,
        args.maxInstrumentWorkers,
        args.maxInstrumentWorkerMemory
      )
  );

  process.exit(0);
}

export async function runProbePSM(
  analysisId: Rowid,
  domainModel: DomainModel,
  maxWorkers: number,
  maxWorkerMemory: number | undefined
) {
  const dao = DataAccessObject.open();

  const { id: domainId, rank: domainRank, name: domainName } = domainModel;

  const spsAnalysisId = dao.getAnalysis(analysisId).parentAnalysisId!;
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
            return bomb(
              () =>
                inputPasswordField(page, {
                  domainName,
                  signupPageUrl,
                  passwordList,
                }),
              ANALYSIS_TIMEOUT_MS
            );
          });

        const ipfResultPre = await runAnalysis([PROBE_PASSWORD]);
        if (!mayDetectPSM(getIPFAbstractResultFromIPFResult(ipfResultPre))) {
          return ipfResultPre;
        }
        const ipfResult = await runAnalysis(getDetectPSMPasswords());
        return [...ipfResult];
      }
    )
  );
  const endTime = currentTime();
  console.log(`end analysis ${domainName} [${domainRank}]`);

  const timeInfo = { startTime, endTime };
  dao.createAnalysisResult(analysisId, domainId, completion, timeInfo);
}
