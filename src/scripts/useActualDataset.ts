import { readFileSync, writeFileSync } from "fs";

const filename = process.argv[2]; // path to dataset by Di Campi et al. or compatible

const entries = readFileSync(filename, "utf8")
  .split("\n")
  .filter((x) => x)
  .map((line) => line.split(" "))
  .map(([rawFrequency, password]) => [password, parseInt(rawFrequency)]);

const selectedEntries = entries
  .slice(1)
  .filter((_, i) => i % 10 === 0)
  .slice(0, 1000);

writeFileSync("dataset.json", JSON.stringify(selectedEntries));
