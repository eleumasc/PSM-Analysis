import { execFileSync } from "child_process";
import { mkdirSync } from "fs";
import path from "path";
import { extractDataPath, makeDataPath } from "../data/path";
import { rootDir } from "../env";
import currentTime from "../util/currentTime";

export default function cmdPlots(args: { reportFilename: string }) {
  const reportDataName = extractDataPath(args.reportFilename);
  const outputDataName = `${currentTime()}-Plots`;
  const outputDir = makeDataPath(outputDataName);
  const plotsDir = path.join(rootDir, "plots");

  mkdirSync(outputDir, { recursive: true });
  console.log(`Output: ${outputDir}`);

  execFileSync(
    "python3",
    [
      path.join(plotsDir, "runPlots.py"),
      makeDataPath(reportDataName),
      outputDir,
    ],
    { cwd: plotsDir, stdio: "inherit" }
  );
}
