import DataAccessObject from "../core/DataAccessObject";
import path from "path";
import { readFileSync } from "fs";

export default async function cmdLoadDomainList(filepath: string) {
  const dao = DataAccessObject.create();

  filepath = path.resolve(filepath);
  const filename = path.basename(filepath);
  const domains = readFileSync(filepath)
    .toString()
    .split(/\r?\n|\r/)
    .map((x) => x.trim())
    .filter((x) => x)
    .map((x) => x.split(",")[1]);

  const domainListId = dao.createDomainList(filename, domains);

  console.log(`Domain List ID: ${domainListId}`);

  process.exit(0);
}
