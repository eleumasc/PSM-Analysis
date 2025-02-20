import currentTime from "../util/currentTime";
import DataAccessObject, { DomainModel, Rowid } from "../core/DataAccessObject";
import filterTestDomain from "../util/filterTestDomain";
import inputPasswordField from "../core/inputPasswordField";
import installAnalysis from "../core/installAnalysis";
import processDomainTaskQueue from "../util/processDomainTaskQueue";
import useBrowser from "../util/useBrowser";
import useWorker from "../core/worker";
import { bomb } from "../util/timeout";
import { getIPFAbstractResultFromIPFResult } from "../core/detection/InputPasswordFieldAbstractResult";
import { mayDetectPSM } from "../core/detection/mayDetectPSM";
import { SearchSignupPageResult } from "../core/searchSignupPage";
import { SIGNUP_PAGE_SEARCH_ANALYSIS_TYPE } from "./cmdSignupPageSearch";
import {
  SAMPLE_STRONG_PASSWORD,
  SAMPLE_WEAK_PASSWORD,
  getSelectedPasswords,
} from "../data/passwords";
import {
  Completion,
  Failure,
  isFailure,
  toCompletion,
} from "../util/Completion";

export const PASSWORD_FIELD_INPUT_ANALYSIS_TYPE = "password_field_input";

const ANALYSIS_TIMEOUT_MS: number = 10 * 60 * 1000; // 10 minutes

export default async function cmdPasswordFieldInput(
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
    maxInstrumentWorkerMemory: number | undefined;
    testDomainName?: string;
  }
) {
  const dao = DataAccessObject.open();

  const analysisId =
    args.action === "create"
      ? dao.createSubAnalysis(
          PASSWORD_FIELD_INPUT_ANALYSIS_TYPE,
          args.parentAnalysisId,
          SIGNUP_PAGE_SEARCH_ANALYSIS_TYPE
        )
      : args.analysisId;
  const todoDomains = filterTestDomain(
    args.testDomainName,
    dao.getTodoDomains(analysisId, PASSWORD_FIELD_INPUT_ANALYSIS_TYPE)
  );

  console.log(`Analysis ID: ${analysisId}`);
  console.log(`${todoDomains.length} domains remaining`);

  await processDomainTaskQueue(
    todoDomains,
    { maxTasks: args.maxTasks },
    (domainModel) => () =>
      runPasswordFieldInput(
        analysisId,
        domainModel,
        args.maxInstrumentWorkers,
        args.maxInstrumentWorkerMemory
      )
  );

  process.exit(0);
}

export async function runPasswordFieldInput(
  analysisId: Rowid,
  domainModel: DomainModel,
  maxWorkers: number,
  maxWorkerMemory: number | undefined
) {
  const dao = DataAccessObject.open();

  const { id: domainId, rank: domainRank, name: domainName } = domainModel;

  const parentCompletion = dao.getAnalysisResult(
    dao.getAnalysis(analysisId).parentAnalysisId!,
    domainId
  ) as Completion<SearchSignupPageResult>;
  if (isFailure(parentCompletion)) {
    dao.createAnalysisResult(analysisId, domainId, Failure());
    return;
  }
  const {
    value: { signupPageUrl },
  } = parentCompletion;
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
                inputPasswordField(
                  page,
                  domainName,
                  signupPageUrl,
                  passwordList
                ),
              ANALYSIS_TIMEOUT_MS
            );
          });

        const ipfResultPre = await runAnalysis([
          SAMPLE_WEAK_PASSWORD,
          SAMPLE_STRONG_PASSWORD,
        ]);
        if (!mayDetectPSM(getIPFAbstractResultFromIPFResult(ipfResultPre))) {
          return ipfResultPre;
        }
        const ipfResult = await runAnalysis(getSelectedPasswords());
        return [...ipfResultPre, ...ipfResult];
      }
    )
  );
  const endTime = currentTime();
  console.log(`end analysis ${domainName} [${domainRank}]`);

  const timeInfo = { startTime, endTime };
  dao.createAnalysisResult(analysisId, domainId, completion, timeInfo);
}
