import { readFileSync, writeFileSync } from "fs";
import _ from "lodash";

const SELECTION_SIZE: number = 1000;

const filename = process.argv[2];

const entries = readFileSync(filename, "utf8")
  .split(/\r?\n/)
  .filter(Boolean)
  .map((line) => line.trim().split(/\s+/, 2))
  .map(([rawFrequency, password]) => [
    password,
    Number.parseInt(rawFrequency, 10),
  ])
  .slice(1); // we exclude the most frequent password, since its exceptionally high frequency made its strength estimate overly dominant in the accuracy of the evaluated PSMs

const frequencies = _.uniq(entries.map(([, frequency]) => frequency));

if (frequencies.length < SELECTION_SIZE) {
  throw new Error(
    `Expected at least ${SELECTION_SIZE} distinct frequencies, but found ${frequencies.length}.`
  );
}

const selectedFrequencies = _.range(SELECTION_SIZE).map((i) => {
  const index = Math.floor(
    (i * (frequencies.length - 1)) / (SELECTION_SIZE - 1)
  );
  return frequencies[index];
});

const selectedEntries = selectedFrequencies.map((frequency) =>
  entries.find(([, f]) => f === frequency)
);

writeFileSync("pwddataset.json", JSON.stringify(selectedEntries));
