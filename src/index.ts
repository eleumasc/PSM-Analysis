import cmdLoadDomainList from "./commands/cmdLoadDomainList";
import cmdSignupPageSearch from "./commands/cmdSignupPageSearch";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

async function main() {
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
      "Start a signup page search analysis",
      (yargs) =>
        yargs
          .positional("domain-list-id", {
            describe: "ID of the domain list to search",
            type: "number",
            demandOption: true,
          })
          .option("max-workers", {
            type: "number",
            default: 1,
          })
          .option("resume", {
            type: "number",
          }),
      ({
        "domain-list-id": domainListId,
        "max-workers": maxWorkers,
        resume: resumeAnalysisId,
      }) => cmdSignupPageSearch(domainListId, { maxWorkers, resumeAnalysisId })
    )
    .demandCommand(1, "You must provide a valid command.")
    .help()
    .alias("help", "h")
    .version("1.0.0")
    .alias("version", "v")
    .strict().argv;
}

main();
