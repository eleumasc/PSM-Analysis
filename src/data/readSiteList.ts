import assert from "assert";
import { readFileSync } from "fs";
import { Site } from "../models/Site";

export function readSiteList(filePath: string): Site[] {
  return readFileSync(filePath)
    .toString()
    .split(/[\r\n]/)
    .map((x) => x.trim())
    .filter((x) => x)
    .map((x): Site => {
      const parts = x.split(",");
      const rank = parseInt(parts[0].trim());
      assert(!isNaN(rank));
      const name = parts[1].trim();
      assert(name);
      return { name, rank };
    });
}
