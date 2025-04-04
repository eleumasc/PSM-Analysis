import path from "path";
import { openDoCo } from "../core/DoCo";
import { readFileSync } from "fs";

export const SITES_COLLECTION_TYPE = "sites";

export const SITES_DOCUMENT_NAME = "sites";

export default async function cmdLoadSiteList(filepath: string) {
  const dc = openDoCo();

  filepath = path.resolve(filepath);
  const filename = path.basename(filepath);
  const sites = readFileSync(filepath)
    .toString()
    .split(/\r?\n|\r/)
    .map((x) => x.trim())
    .filter((x) => x)
    .map((x) => x.split(",")[1]);

  const sitesCollection = dc.createCollection(null, filename, {
    type: SITES_COLLECTION_TYPE,
  });
  dc.createDocument(sitesCollection.id, SITES_DOCUMENT_NAME, sites);

  console.log(`Sites Collection ID: ${sitesCollection.id}`);

  process.exit(0);
}
