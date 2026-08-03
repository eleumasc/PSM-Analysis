import cmdAnalyze from "./commands/cmdAnalyze";
import cmdMeasure from "./commands/cmdMeasure";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

async function main() {
  console.log(`PID: ${process.pid}`);

  yargs(hideBin(process.argv))
    .command(
      "analyze <siteListPath>",
      "Create a new PSM analysis",
      (yargs) =>
        yargs
          .positional("siteListPath", {
            type: "string",
            demandOption: true,
          })
          .option("maxTasks", {
            type: "number",
            default: 1,
          })
          .option("rpdOnly", {
            type: "boolean",
            default: false,
          }),
      (args) => cmdAnalyze({ action: "create", ...args })
    )
    .command(
      "analyze:resume <analyzeOutDir>",
      "Resume an existing PSM analysis",
      (yargs) =>
        yargs
          .positional("analyzeOutDir", {
            type: "string",
            demandOption: true,
          })
          .option("maxTasks", {
            type: "number",
            default: 1,
          })
          .option("rpdOnly", {
            type: "boolean",
            default: false,
          }),
      (args) => cmdAnalyze({ action: "resume", ...args })
    )

    .command(
      "measure <analyzeOutDir>",
      "Perform data processing from a PSM analysis",
      (yargs) =>
        yargs.positional("analyzeOutDir", {
          type: "string",
          demandOption: true,
        }),
      (args) => cmdMeasure(args)
    )

    .demandCommand(1, "You must provide a valid command.")
    .help()
    .alias("help", "h")
    .version("1.0.0")
    .alias("version", "v")
    .strict().argv;
}

process.on("uncaughtException", (err, origin) => {
  console.error("!!! UNCAUGHT EXCEPTION !!!", err, origin);
});

main();
