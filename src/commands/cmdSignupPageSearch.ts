import currentTime from "../util/currentTime";
import DataAccessObject, { DomainModel, Rowid } from "../core/DataAccessObject";
import searchSignupPage from "../core/searchSignupPage";
import useBrowser from "../util/useBrowser";
import useWorker from "../core/worker";
import { bomb } from "../util/timeout";
import { DEFAULT_ANALYSIS_TIMEOUT_MS } from "../core/defaults";
import { toCompletion } from "../util/Completion";

export const SIGNUP_PAGE_SEARCH_ANALYSIS_TYPE = "signup_page_search";

export default async function cmdSignupPageSearch(
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
    maxWorkers: number;
  }
) {
  const dao = DataAccessObject.open();

  const analysisId =
    args.action === "create"
      ? dao.createTopAnalysis(
          SIGNUP_PAGE_SEARCH_ANALYSIS_TYPE,
          args.domainListId
        )
      : args.analysisId;
  const todoDomains = dao.getTodoDomains(
    analysisId,
    SIGNUP_PAGE_SEARCH_ANALYSIS_TYPE
  );

  console.log(`Analysis ID: ${analysisId}`);
  console.log(`${todoDomains.length} domains remaining`);

  await useWorker(
    {
      maxWorkers: args.maxWorkers,
    },
    async (workerExec) => {
      await Promise.all(
        todoDomains.map((domainModel) =>
          workerExec(runSignupPageSearch, [analysisId, domainModel])
        )
      );
    }
  );

  process.exit(0);
}

export async function runSignupPageSearch(
  analysisId: Rowid,
  domainModel: DomainModel
) {
  const dao = DataAccessObject.open();

  const { id: domainId, rank: domainRank, domain } = domainModel;

  console.log(`begin analysis ${domain} [${domainRank}]`);
  const startTime = currentTime();
  const result = await toCompletion(() =>
    useBrowser(async (browser) => {
      const page = await browser.newPage();
      return await bomb(
        () => searchSignupPage(page, domain),
        DEFAULT_ANALYSIS_TIMEOUT_MS
      );
    })
  );
  const endTime = currentTime();
  console.log(`end analysis ${domain} [${domainRank}]`);

  const timeInfo = { startTime, endTime };
  dao.createAnalysisResult(analysisId, domainId, result, timeInfo);
}
