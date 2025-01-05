import DataAccessObject from "./DataAccessObject";
import searchSignupPage from "./searchSignupPage";
import useBrowser from "./useBrowser";
import { toCompletion } from "./Completion";

export default async function commandSignupPageSearch(domainListId: number) {
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
