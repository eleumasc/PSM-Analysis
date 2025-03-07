import cmdDetectPSM from "./commands/cmdDetectPSM";
import cmdLoadDomainList from "./commands/cmdLoadDomainList";
import cmdMeasure from "./commands/cmdMeasure";
import cmdProbePSM from "./commands/cmdProbePSM";
import cmdQueryPSM from "./commands/cmdQueryPSM";
import cmdSearchSignupPage from "./commands/cmdSearchSignupPage";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

async function main() {
  console.log(`PID: ${process.pid}`);

  yargs(hideBin(process.argv))
    .command(
      "load-domain-list <filepath>",
      "Load a domain list (Tranco) from a file",
      (yargs) =>
        yargs.positional("filepath", {
          describe: "Path to the file containing the domain list",
          type: "string",
          demandOption: true,
        }),
      ({ filepath }) => cmdLoadDomainList(filepath)
    )

    .command(
      "search-signup-page <domain-list-id>",
      "Create a new search signup page analysis",
      (yargs) =>
        yargs
          .positional("domain-list-id", {
            describe: "ID of the domain list to search",
            type: "number",
            demandOption: true,
          })
          .option("max-tasks", {
            type: "number",
            default: 1,
          }),
      (args) => cmdSearchSignupPage({ action: "create", ...args })
    )
    .command(
      "search-signup-page:resume <analysis-id>",
      "Resume an existing search signup page analysis",
      (yargs) =>
        yargs
          .positional("analysis-id", {
            describe: "ID of the analysis to resume",
            type: "number",
            demandOption: true,
          })
          .option("max-tasks", {
            type: "number",
            default: 1,
          }),
      (args) => cmdSearchSignupPage({ action: "resume", ...args })
    )

    .command(
      "probe-psm <parent-analysis-id>",
      "Create a new input password field analysis",
      (yargs) =>
        yargs
          .positional("parent-analysis-id", {
            describe: "ID of the signup page search analysis to search",
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
          .option("test-domain-name", {
            type: "string",
          }),
      (args) => cmdProbePSM({ action: "create", ...args })
    )
    .command(
      "probe-psm:resume <analysis-id>",
      "Resume an existing input password field analysis",
      (yargs) =>
        yargs
          .positional("analysis-id", {
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
          }),
      (args) => cmdProbePSM({ action: "resume", ...args })
    )

    .command(
      "detect-psm <probe-analysis-id>",
      "Detect PSM from an input password field analysis",
      (yargs) =>
        yargs
          .positional("probe-analysis-id", {
            type: "number",
            describe:
              "ID of the password input field analysis to detect PSM from",
            demandOption: true,
          })
          .option("db-filepath", {
            type: "string",
          }),
      (args) => cmdDetectPSM(args)
    )

    .command(
      "query-psm <parent-analysis-id>",
      "Create a new query PSM analysis",
      (yargs) =>
        yargs
          .positional("parent-analysis-id", {
            describe: "ID of the input password field analysis to search",
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
          .option("test-domain-name", {
            type: "string",
          }),
      (args) => cmdQueryPSM({ action: "create", ...args })
    )
    .command(
      "query-psm:resume <analysis-id>",
      "Resume an existing query PSM analysis",
      (yargs) =>
        yargs
          .positional("analysis-id", {
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
          }),
      (args) => cmdQueryPSM({ action: "resume", ...args })
    )

    .command(
      "measure <query-analysis-id>",
      "Detect PSM from a query PSM analysis",
      (yargs) =>
        yargs
          .positional("query-analysis-id", {
            type: "number",
            describe: "ID of the query PSM analysis to measure from",
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

main();
