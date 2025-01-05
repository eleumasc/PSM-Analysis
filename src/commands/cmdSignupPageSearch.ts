import DataAccessObject from "../core/DataAccessObject";
import searchSignupPage from "../core/searchSignupPage";
import useBrowser from "../util/useBrowser";
import { toCompletion } from "../core/Completion";

export default async function cmdSignupPageSearch(domainListId: number) {
  const dao = DataAccessObject.open();

  const processId = dao.createSignupPageSearch(domainListId);
  console.log(`Process ID: ${processId}`);

  for (const entry of dao.readDomainList(domainListId)) {
    const { id: domainId, domain } = entry;
    const completion = await toCompletion(() =>
      useBrowser(async (browser) => {
        const page = await browser.newPage();
        return await searchSignupPage(page, domain);
      })
    );

    dao.createSignupPageSearchResult(processId, domainId, completion);
  }

  process.exit(0);
}
