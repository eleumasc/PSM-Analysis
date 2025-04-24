import assert from "assert";
import { readFileSync } from "fs";

export const TEST_PASSWORD: string = "fd*KZ$?J9Q2Fg!cz";

/**
 * - First sequence exception: known patterns, increasing entropy and length, fixed complexity
 * - Neither dictionary words nor known patterns (guessability depends exclusively on entropy, bruteforce required)
 * - Increasing entropy and length in every sequence
 * - Increasing complexity
 */
export const MONOTONE_TEST_PASSWORDS_SEQUENCES: string[][] = [
  [
    "a!1A",
    "aaa!1A",
    "aaaaa!1A",
    "aaaaaaa!1A",
    "aaaaaaaaa!1A",
    "aaaaaaaaaaaaa!1A",
  ],
  [
    "vshb",
    "vshbnc",
    "vshbncqa",
    "vshbncqajp",
    "vshbncqajpzk",
    "vshbncqajpzkewmd",
  ],
  [
    "vshA",
    "vshbnA",
    "vshbncqA",
    "vshbncqajA",
    "vshbncqajpzA",
    "vshbncqajpzkewmA",
  ],
  [
    "vs1A",
    "vshb1A",
    "vshbnc1A",
    "vshbncqa1A",
    "vshbncqajp1A",
    "vshbncqajpzkew1A",
  ],
  [
    "v!1A",
    "vsh!1A",
    "vshbn!1A",
    "vshbncq!1A",
    "vshbncqaj!1A",
    "vshbncqajpzke!1A",
  ],
];

export function getMonotoneTestPasswords(): string[] {
  return MONOTONE_TEST_PASSWORDS_SEQUENCES.flat();
}

export type DatasetEntry = [string, number];

let _datasetEntries: DatasetEntry[];
export function getDatasetEntries(): DatasetEntry[] {
  if (!_datasetEntries) {
    const data = JSON.parse(readFileSync("dataset.json", "utf8")) as unknown;
    assert(Array.isArray(data));
    assert(
      data.every(
        (e): e is DatasetEntry =>
          Array.isArray(e) &&
          e.length === 2 &&
          typeof e[0] === "string" &&
          typeof e[1] === "number"
      )
    );
    _datasetEntries = data;
  }
  return _datasetEntries;
}

export function getDatasetPasswords(): string[] {
  return getDatasetEntries().map(([password]) => password);
}
