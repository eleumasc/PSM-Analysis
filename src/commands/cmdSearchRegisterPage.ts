import _ from "lodash";
import assert from "assert";
import currentTime from "../util/currentTime";
import processTaskQueue from "../util/processTaskQueue";
import searchRegisterPage from "../core/searchRegisterPage";
import useBrowser from "../util/useBrowser";
import { bomb } from "../util/timeout";
import { openDoCo } from "../core/DoCo";
import { SITES_COLLECTION_TYPE, SITES_DOCUMENT_NAME } from "./cmdLoadSiteList";
import { toCompletion } from "../util/Completion";

export const REGISTER_PAGES_COLLECTION_TYPE = "register_pages";

const ANALYSIS_TIMEOUT_MS: number = 5 * 60 * 1000; // 5 minutes

export default async function cmdSearchRegisterPage(
  args: (
    | {
        action: "create";
        sitesId: number;
      }
    | {
        action: "resume";
        outputId: number;
      }
  ) & {
    maxTasks: number;
  }
) {
  const dc = openDoCo();

  const outputCollection =
    args.action === "create"
      ? dc.createCollection(
          (() => {
            const sitesCollection = dc.getCollectionById(args.sitesId);
            assert(sitesCollection.meta.type === SITES_COLLECTION_TYPE);
            return sitesCollection.id;
          })(),
          currentTime().toString(),
          { type: REGISTER_PAGES_COLLECTION_TYPE }
        )
      : dc.getCollectionById(args.outputId);
  assert(outputCollection.meta.type === REGISTER_PAGES_COLLECTION_TYPE);
  const sitesCollectionId = outputCollection.parentId!;

  const tbdSites = _.difference(
    // all sites
    dc.getDocumentData(
      dc.getDocumentByName(sitesCollectionId, SITES_DOCUMENT_NAME).id
    ) as string[],
    // processed sites
    dc
      .getDocumentsByCollection(outputCollection.id)
      .map((document) => document.name)
  );

  console.log(`Output ID: ${outputCollection.id}`);
  console.log(`${tbdSites.length} sites remaining`);

  await processTaskQueue(
    tbdSites,
    { maxTasks: args.maxTasks },
    (site, queueIndex) => async () => {
      console.log(`begin analysis ${site} [${queueIndex}]`);
      const result = await runSearchRegisterPage(site);
      console.log(`end analysis ${site} [${queueIndex}]`);
      dc.createDocument(outputCollection.id, site, result);
    }
  );

  process.exit(0);
}

export async function runSearchRegisterPage(site: string) {
  return toCompletion(() =>
    useBrowser(async (browser) => {
      const page = await browser.newPage();
      return bomb(() => searchRegisterPage(page, site), ANALYSIS_TIMEOUT_MS);
    })
  );
}
