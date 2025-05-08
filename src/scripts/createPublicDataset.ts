import _ from "lodash";
import assert from "assert";
import createSeededRandom from "../util/seededRandom";
import { DatasetEntry } from "../data/passwords";
import { readFileSync, writeFileSync } from "fs";
import {
  reDigit,
  reLower,
  reSpecial,
  reUpper
  } from "../data/regexps";

const entries = JSON.parse(
  readFileSync("dataset.json", "utf8")
) as DatasetEntry[];

const rnd = createSeededRandom(0);
function generateRedactedPassword(password: string): string {
  function part(re: () => RegExp, charSet: string): string {
    const count = [...password.matchAll(re())].length;
    let result = "";
    for (let i = 0; i < count; i++) {
      const randIndex = Math.floor(rnd() * charSet.length);
      result += charSet[randIndex];
    }
    return result;
  }

  const redactedPassword = [
    part(reLower, "abcdefghijklmnopqrstuvwxyz"),
    part(reUpper, "ABCDEFGHIJKLMNOPQRSTUVWXYZ"),
    part(reDigit, "0123456789"),
    part(reSpecial, "!@#$%^&*()_+-=[]{}|;:,.<>?"),
  ].join("");
  assert(redactedPassword.length === password.length);
  return redactedPassword;
}

const uniqueRedactedPasswords = new Set<string>();
function generateUniqueRedactedPassword(password: string): string {
  let ttl = entries.length;
  let redactedPassword;
  while (
    ((redactedPassword = generateRedactedPassword(password)),
    uniqueRedactedPasswords.has(redactedPassword))
  ) {
    ttl -= 1;
    if (ttl === 0) {
      throw new Error(
        `Cannot generate unique redacted password (password is ${password})`
      );
    }
  }
  uniqueRedactedPasswords.add(redactedPassword);
  return redactedPassword;
}

const redactedEntries = entries.map(
  ([password, frequency]): DatasetEntry => [
    generateUniqueRedactedPassword(password),
    frequency,
  ]
);
assert(_.map(_.uniq(redactedEntries), 0).length === redactedEntries.length);

writeFileSync("dataset-pub.json", JSON.stringify(redactedEntries));
