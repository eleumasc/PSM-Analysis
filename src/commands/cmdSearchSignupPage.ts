import currentTime from "../util/currentTime";
import DataAccessObject, { DomainModel, Rowid } from "../core/DataAccessObject";
import processDomainTaskQueue from "../util/processDomainTaskQueue";
import searchSignupPage from "../core/searchSignupPage";
import useBrowser from "../util/useBrowser";
import { bomb } from "../util/timeout";
import { toCompletion } from "../util/Completion";

export const SEARCH_SIGNUP_PAGE_ANALYSIS_TYPE = "search_signup_page";

const ANALYSIS_TIMEOUT_MS: number = 5 * 60 * 1000; // 5 minutes

export default async function cmdSearchSignupPage(
  args: (
    | {
        action: "create";
        domainListId: number;
      }
    | {
        action: "resume";
        analysisId: number;
      }
  ) & {
    maxTasks: number;
  }
) {
  const dao = DataAccessObject.open();

  const analysisId =
    args.action === "create"
      ? dao.createTopAnalysis(
          SEARCH_SIGNUP_PAGE_ANALYSIS_TYPE,
          args.domainListId
        )
      : args.analysisId;
  const todoDomains = dao.getTodoDomains(
    analysisId,
    SEARCH_SIGNUP_PAGE_ANALYSIS_TYPE
  );

  console.log(`Analysis ID: ${analysisId}`);
  console.log(`${todoDomains.length} domains remaining`);

  await processDomainTaskQueue(
    todoDomains,
    { maxTasks: args.maxTasks },
    (domainModel) => () => runSearchSignupPage(analysisId, domainModel)
  );

  process.exit(0);
}

export async function runSearchSignupPage(
  analysisId: Rowid,
  domainModel: DomainModel
) {
  const dao = DataAccessObject.open();

  const { id: domainId, rank: domainRank, name: domainName } = domainModel;

  console.log(`begin analysis ${domainName} [${domainRank}]`);
  const startTime = currentTime();
  const result = await toCompletion(() =>
    useBrowser(async (browser) => {
      const page = await browser.newPage();
      return bomb(
        () => searchSignupPage(page, domainName),
        ANALYSIS_TIMEOUT_MS
      );
    })
  );
  const endTime = currentTime();
  console.log(`end analysis ${domainName} [${domainRank}]`);

  const timeInfo = { startTime, endTime };
  dao.createAnalysisResult(analysisId, domainId, result, timeInfo);
}
