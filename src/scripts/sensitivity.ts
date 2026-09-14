import _ from "lodash";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { getPSMAccuracy, PSMAccuracyScoreEntry } from "../core/psm/PSMAccuracy";
import { _parseDatasetEntries, DatasetEntry } from "../data/passwords";
import assert from "assert";
import { readFileSync, writeFileSync } from "fs";
import { extractDataPath, makeDataPath } from "../data/path";
import currentTime from "../util/currentTime";

async function main(args: { datasetPath: string }) {
  const { datasetPath } = args;
  const datasetEntries: DatasetEntry[] = _parseDatasetEntries(
    readFileSync(extractDataPath(datasetPath), "utf8"),
  );
  assert(datasetEntries.length > 0);

  const accScoreEntries = createInitialPSMAccuracyScoreEntries(datasetEntries);
  assert(getPSMAccuracy(accScoreEntries) === 1);
  const maxScore = accScoreEntries.at(-1)!.referenceScore + 1;

  const res = accScoreEntries.map(
    (entry, index) =>
      1 -
      _.min(
        _.range(0, maxScore + 2).map((varScore) =>
          getPSMAccuracy([
            ...accScoreEntries.slice(0, index),
            ...accScoreEntries.slice(index + 1),
            { ...entry, evaluatedScore: varScore },
          ]),
        ),
      )!,
  );

  writeFileSync(
    makeDataPath(`${currentTime()}-sensitivity.json`),
    JSON.stringify(res),
  );
}

yargs(hideBin(process.argv))
  .command(
    "$0 <datasetPath>",
    "Calculate sensitivity for a dataset",
    (yargs) =>
      yargs.positional("datasetPath", {
        type: "string",
        demandOption: true,
        description: "Path to a dataset JSON file",
      }),
    (args) => main(args),
  )
  .strict()
  .help().argv;

function createInitialPSMAccuracyScoreEntries(
  datasetEntries: DatasetEntry[],
): PSMAccuracyScoreEntry[] {
  const scoreMap = new Map(
    _.reverse(_.sortBy(_.uniq(datasetEntries.map((e) => e[1])))) //
      .map((frequency, index) => [frequency, index * 2 + 1]),
  );
  return datasetEntries.map((e): PSMAccuracyScoreEntry => {
    const frequency = e[1];
    const score = scoreMap.get(frequency);
    assert(score !== undefined);
    return {
      referenceScore: score,
      evaluatedScore: score,
      frequency: frequency,
    };
  });
}
