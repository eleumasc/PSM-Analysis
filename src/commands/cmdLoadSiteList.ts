import openDocumentStore from "../core/openDocumentStore";
import path from "path";
import { readFileSync } from "fs";

export const SITES_COLLECTION_TYPE = "sites";

export const SITES_DOCUMENT_NAME = "sites";

export default async function cmdLoadSiteList(filepath: string) {
  const store = openDocumentStore();

  filepath = path.resolve(filepath);
  const filename = path.basename(filepath);
  const sites = readFileSync(filepath)
    .toString()
    .split(/\r?\n|\r/)
    .map((x) => x.trim())
    .filter((x) => x)
    .map((x) => x.split(",")[1]);

  const sitesCollection = store.createCollection(null, filename, {
    type: SITES_COLLECTION_TYPE,
  });
  store.createDocument(sitesCollection.id, SITES_DOCUMENT_NAME, sites);

  console.log(`Sites Collection ID: ${sitesCollection.id}`);

  process.exit(0);
}
