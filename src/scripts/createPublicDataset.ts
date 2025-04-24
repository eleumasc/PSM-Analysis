import _ from "lodash";
import assert from "assert";
import crypto from "crypto";
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

function generateRedactedPassword(password: string): string {
  const hash = crypto.createHash("sha256").update(password).digest("hex");

  let hashIndex = 0;
  function seededRandom(): number {
    if (hashIndex + 4 > hash.length) hashIndex = 0;
    const slice = hash.slice(hashIndex, hashIndex + 4);
    hashIndex += 4;
    return parseInt(slice, 16) / 0xffff;
  }

  function part(re: () => RegExp, charSet: string): string {
    const count = [...password.matchAll(re())].length;
    let result = "";
    for (let i = 0; i < count; i++) {
      const randIndex = Math.floor(seededRandom() * charSet.length);
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

const redactedEntries = entries.map(
  ([password, frequency]): DatasetEntry => [
    generateRedactedPassword(password),
    frequency,
  ]
);
assert(_.map(_.uniq(redactedEntries), 0).length === redactedEntries.length);

writeFileSync("dataset-pub.json", JSON.stringify(redactedEntries));
