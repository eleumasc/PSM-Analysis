import { readFileSync } from "fs";

const filename = process.argv[2];

const content = readFileSync(filename).toString();

const rows = content
  .split("\n")
  .filter((x) => x)
  .map((line) => line.split(" "))
  .map(([rawFrequency, password]) => [password, parseInt(rawFrequency)]);

const selectedRows = rows.filter((_, i) => i % 10000 === 0).slice(0, 100);

console.log(selectedRows);
console.log(JSON.stringify(selectedRows));
