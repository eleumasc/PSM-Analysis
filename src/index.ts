import cmdAnalyze from "./commands/cmdAnalyze";
import cmdLoadSiteList from "./commands/cmdLoadSiteList";
import cmdMeasure from "./commands/cmdMeasure";
import cmdSearchRegisterPage from "./commands/cmdSearchRegisterPage";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

async function main() {
  console.log(`PID: ${process.pid}`);

  yargs(hideBin(process.argv))
    .command(
      "load-site-list <filepath>",
      "Load a site list (Tranco) from a file",
      (yargs) =>
        yargs.positional("filepath", {
          describe: "Path to the file containing the site list",
          type: "string",
          demandOption: true,
        }),
      ({ filepath }) => cmdLoadSiteList(filepath)
    )

    .command(
      "search-register-page <sites-id>",
      "Create a new search register page analysis",
      (yargs) =>
        yargs
          .positional("sites-id", {
            describe: "ID of the sites collection",
            type: "number",
            demandOption: true,
          })
          .option("max-tasks", {
            type: "number",
            default: 1,
          })
          .option("no-headless-browser", {
            type: "boolean",
            default: false,
          }),
      (args) => cmdSearchRegisterPage({ action: "create", ...args })
    )
    .command(
      "search-register-page:resume <output-id>",
      "Resume an existing search register page analysis",
      (yargs) =>
        yargs
          .positional("output-id", {
            describe: "ID of the analysis to resume",
            type: "number",
            demandOption: true,
          })
          .option("max-tasks", {
            type: "number",
            default: 1,
          })
          .option("no-headless-browser", {
            type: "boolean",
            default: false,
          }),
      (args) => cmdSearchRegisterPage({ action: "resume", ...args })
    )

    .command(
      "analyze <register-pages-id>",
      "Create a new PSM analysis",
      (yargs) =>
        yargs
          .positional("register-pages-id", {
            describe: "ID of the register pages collection",
            type: "number",
            demandOption: true,
          })
          .option("max-tasks", {
            type: "number",
            default: 1,
          })
          .option("max-instrument-workers", {
            type: "number",
            default: 1,
          })
          .option("no-headless-browser", {
            type: "boolean",
            default: false,
          }),
      (args) => cmdAnalyze({ action: "create", ...args })
    )
    .command(
      "analyze:resume <output-id>",
      "Resume an existing PSM analysis",
      (yargs) =>
        yargs
          .positional("output-id", {
            describe: "ID of the analysis to resume",
            type: "number",
            demandOption: true,
          })
          .option("max-tasks", {
            type: "number",
            default: 1,
          })
          .option("max-instrument-workers", {
            type: "number",
            default: 1,
          })
          .option("no-headless-browser", {
            type: "boolean",
            default: false,
          }),
      (args) => cmdAnalyze({ action: "resume", ...args })
    )

    .command(
      "measure <psm-analysis-id>",
      "Perform data processing from a PSM analysis",
      (yargs) =>
        yargs
          .positional("psm-analysis-id", {
            type: "number",
            describe: "ID of the PSM analysis collection",
            demandOption: true,
          })
          .option("db-filepath", {
            type: "string",
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
