import currentTime from "../util/currentTime";
import DataAccessObject, { DomainEntry, Rowid } from "../core/DataAccessObject";
import searchSignupPage from "../core/searchSignupPage";
import useBrowser from "../util/useBrowser";
import useWorker from "../core/worker";
import { Maybe } from "../util/Maybe";
import { toCompletion } from "../util/Completion";

const SIGNUP_PAGE_SEARCH_ANALYSIS_TYPE = "signup_page_search";

export default async function cmdSignupPageSearch(
  domainListId: number,
  options: {
    maxWorkers: number;
    resumeAnalysisId: Maybe<Rowid>;
  }
) {
  const dao = DataAccessObject.open();

  const analysisId =
    options.resumeAnalysisId ??
    dao.createAnalysis(SIGNUP_PAGE_SEARCH_ANALYSIS_TYPE, domainListId);
  const domainList = dao.readResidualDomainList(
    analysisId,
    SIGNUP_PAGE_SEARCH_ANALYSIS_TYPE,
    domainListId
  );

  console.log(`Analysis ID: ${analysisId}`);
  console.log(`${domainList.length} residual domains`);

  await useWorker(
    {
      maxWorkers: options.maxWorkers,
    },
    async (workerExec) => {
      await Promise.all(
        domainList.map((entry, index) =>
          workerExec(runSignupPageSearch, [analysisId, entry, index])
        )
      );
    }
  );

  process.exit(0);
}

export async function runSignupPageSearch(
  analysisId: Rowid,
  domainEntry: DomainEntry,
  domainIndex: number
) {
  const dao = DataAccessObject.open();

  const { id: domainId, domain } = domainEntry;

  console.log(`begin analysis ${domain} [${domainIndex}]`);
  const startTime = currentTime();
  const completion = await toCompletion(() =>
    useBrowser(async (browser) => {
      const page = await browser.newPage();
      return await searchSignupPage(page, domain);
    })
  );
  const endTime = currentTime();
  console.log(`end analysis ${domain} [${domainIndex}]`);

  const timeInfo = { startTime, endTime };
  dao.createAnalysisResult(analysisId, domainId, completion, timeInfo);
}
