import { readFileSync } from "fs";

const filename = process.argv[2];

const content = readFileSync(filename).toString();

const rows = content
  .split("\n")
  .filter((x) => x)
  .map((line) => line.split(" "))
  .map(([rawFrequency, password]) => [password, parseInt(rawFrequency)]);

const selectedRows = rows
  .slice(1)
  .filter((_, i) => i % 10 === 0)
  .slice(0, 1000);

console.log(selectedRows);
console.log(JSON.stringify(selectedRows));
