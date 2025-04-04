import DoCoLite from "../util/DoCoLite";
import path from "path";
import { rootDir } from "../rootDir";

const DB_FILEPATH = path.join(rootDir, "psm-analysis.sqlite");

export function openDoCo(dbFilepath?: string): DoCoLite {
  return DoCoLite.open(dbFilepath ?? DB_FILEPATH);
}
