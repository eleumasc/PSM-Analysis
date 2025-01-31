import cmdLoadDomainList from "./commands/cmdLoadDomainList";
import cmdMeasure from "./commands/cmdMeasure";
import cmdPasswordFieldInput from "./commands/cmdPasswordFieldInput";
import cmdSignupPageSearch from "./commands/cmdSignupPageSearch";
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
      "signup-page-search <domain-list-id>",
      "Create a new signup page search analysis",
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
      (args) => cmdSignupPageSearch({ action: "create", ...args })
    )
    .command(
      "signup-page-search:resume <analysis-id>",
      "Resume an existing signup page search analysis",
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
      (args) => cmdSignupPageSearch({ action: "resume", ...args })
    )

    .command(
      "password-field-input <parent-analysis-id>",
      "Create a new password field input analysis",
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
          .option("max-instrument-worker-memory", {
            type: "number",
          }),
      (args) => cmdPasswordFieldInput({ action: "create", ...args })
    )
    .command(
      "password-field-input:resume <analysis-id>",
      "Resume an existing password field input analysis",
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
          })
          .option("max-instrument-worker-memory", {
            type: "number",
          }),
      (args) => cmdPasswordFieldInput({ action: "resume", ...args })
    )

    .command(
      "measure <pfi-analysis-id>",
      "Start measurement",
      (yargs) =>
        yargs
          .positional("pfi-analysis-id", {
            type: "number",
            describe:
              "ID of the password input field analysis to start measurement from",
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
