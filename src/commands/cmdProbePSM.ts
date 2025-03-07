import currentTime from "../util/currentTime";
import DataAccessObject, { DomainModel, Rowid } from "../core/DataAccessObject";
import filterTestDomain from "../util/filterTestDomain";
import installAnalysis from "../core/installAnalysis";
import processDomainTaskQueue from "../util/processDomainTaskQueue";
import useBrowser from "../util/useBrowser";
import useWorker from "../core/worker";
import { bomb } from "../util/timeout";
import { getDetectPSMPasswords, PROBE_PASSWORD } from "../data/passwords";
import { getIPFAbstractResultFromIPFResult } from "../core/detection/InputPasswordFieldAbstractResult";
import { InputPasswordFieldResult } from "../core/InputPasswordFieldResult";
import { mayDetectPSM } from "../core/detection/mayDetectPSM";
import { SEARCH_SIGNUP_PAGE_ANALYSIS_TYPE } from "./cmdSearchSignupPage";
import { SearchSignupPageResult } from "../core/searchSignupPage";
import inputPasswordField, {
  InputPasswordFieldHint,
} from "../core/inputPasswordField";
import {
  Completion,
  Failure,
  isFailure,
  toCompletion,
} from "../util/Completion";

export type ProbePSMResult = {
  ipfResultPre: InputPasswordFieldResult;
} & (
  | {
      ipfResult: InputPasswordFieldResult;
      ipfHint: InputPasswordFieldHint;
    }
  | {
      ipfResult: undefined;
      ipfHint: undefined;
    }
);

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
      runProbePSM(analysisId, domainModel, args.maxInstrumentWorkers)
  );

  process.exit(0);
}

export async function runProbePSM(
  analysisId: Rowid,
  domainModel: DomainModel,
  maxWorkers: number
) {
  const dao = DataAccessObject.open();

  const { id: domainId, rank: domainRank, name: domainName } = domainModel;

  const dependencies = (() => {
    const spsAnalysisId = dao.getAnalysis(analysisId).parentAnalysisId!;
    const spsCompletion = dao.getAnalysisResult(
      spsAnalysisId,
      domainId
    ) as Completion<SearchSignupPageResult>;
    if (isFailure(spsCompletion)) return;
    const {
      value: { signupPageUrl },
    } = spsCompletion;
    if (signupPageUrl === null) return;
    return { signupPageUrl };
  })();
  if (!dependencies) {
    dao.createAnalysisResult(analysisId, domainId, Failure());
    return;
  }
  const { signupPageUrl } = dependencies;

  console.log(`begin analysis ${domainName} [${domainRank}]`);
  const startTime = currentTime();
  const completion = await toCompletion(() =>
    useWorker(
      {
        maxWorkers,
      },
      async (workerExec) => {
        const runAnalysis = (
          passwordList: string[],
          hint?: InputPasswordFieldHint
        ) =>
          useBrowser(async (browser) => {
            const page = await browser.newPage();
            await installAnalysis(page, { workerExec });
            return bomb(
              () =>
                inputPasswordField(page, {
                  domainName,
                  signupPageUrl,
                  passwordList,
                  hint,
                }),
              ANALYSIS_TIMEOUT_MS
            );
          });

        const ipfResultPre = await runAnalysis([PROBE_PASSWORD]);
        const ipfHint = mayDetectPSM(
          getIPFAbstractResultFromIPFResult(ipfResultPre)
        );
        if (!ipfHint) {
          return <ProbePSMResult>{ ipfResultPre };
        }
        const ipfResult = await runAnalysis(
          [...getDetectPSMPasswords(), PROBE_PASSWORD],
          ipfHint
        );
        return <ProbePSMResult>{ ipfResultPre, ipfResult, ipfHint };
      }
    )
  );
  const endTime = currentTime();
  console.log(`end analysis ${domainName} [${domainRank}]`);

  const timeInfo = { startTime, endTime };
  dao.createAnalysisResult(analysisId, domainId, completion, timeInfo);
}
