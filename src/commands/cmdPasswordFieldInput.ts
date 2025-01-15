import currentTime from "../util/currentTime";
import DataAccessObject, { DomainModel, Rowid } from "../core/DataAccessObject";
import inputPasswordField from "../core/inputPasswordField";
import installAnalysis from "../core/installAnalysis";
import processDomainTaskQueue from "../core/processDomainTaskQueue";
import useBrowser from "../util/useBrowser";
import useWorker from "../core/worker";
import { bomb } from "../util/timeout";
import { DEFAULT_ANALYSIS_TIMEOUT_MS } from "../core/defaults";
import { SearchSignupPageResult } from "../core/searchSignupPage";
import { SIGNUP_PAGE_SEARCH_ANALYSIS_TYPE } from "./cmdSignupPageSearch";
import {
  Completion,
  Failure,
  isFailure,
  toCompletion,
} from "../util/Completion";

export const PASSWORD_FIELD_INPUT_ANALYSIS_TYPE = "password_field_input";

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
  const todoDomains = dao.getTodoDomains(
    analysisId,
    PASSWORD_FIELD_INPUT_ANALYSIS_TYPE
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

  const { id: domainId, rank: domainRank, domain } = domainModel;

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

  console.log(`begin analysis ${domain} [${domainRank}]`);
  const startTime = currentTime();
  const completion = await toCompletion(() =>
    useWorker(
      {
        maxWorkers,
        maxWorkerMemory,
      },
      (workerExec) =>
        useBrowser(async (browser) => {
          const page = await browser.newPage();
          await installAnalysis(page, { workerExec });
          return await bomb(
            () => inputPasswordField(page, domain, signupPageUrl),
            DEFAULT_ANALYSIS_TIMEOUT_MS
          );
        })
    )
  );
  const endTime = currentTime();
  console.log(`end analysis ${domain} [${domainRank}]`);

  const timeInfo = { startTime, endTime };
  dao.createAnalysisResult(analysisId, domainId, completion, timeInfo);
}
