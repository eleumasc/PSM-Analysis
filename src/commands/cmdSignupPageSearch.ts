import currentTime from "../util/currentTime";
import DataAccessObject, { DomainEntry, Rowid } from "../core/DataAccessObject";
import searchSignupPage from "../core/searchSignupPage";
import useBrowser from "../util/useBrowser";
import useWorker from "../core/worker";
import { toCompletion } from "../core/Completion";

export default async function cmdSignupPageSearch(
  domainListId: number,
  options: {
    maxWorkers: number;
  }
) {
  const dao = DataAccessObject.open();

  const processId = dao.createAnalysis("signup_page_search", domainListId);
  console.log(`Process ID: ${processId}`);

  const domainList = dao.readDomainList(domainListId);

  await useWorker(
    {
      maxWorkers: options.maxWorkers,
    },
    async (workerExec) => {
      await Promise.all(
        domainList.map((entry, index) =>
          workerExec(signupPageSearchProcess, [processId, entry, index])
        )
      );
    }
  );

  process.exit(0);
}

export async function signupPageSearchProcess(
  processId: Rowid,
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
  dao.createAnalysisResult(processId, domainId, completion, timeInfo);
}
