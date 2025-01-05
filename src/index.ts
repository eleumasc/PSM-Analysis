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
      "Start a signup page search process",
      (yargs) =>
        yargs.positional("domain-list-id", {
          describe: "ID of the domain list to search on",
          type: "number",
          demandOption: true,
        }),
      ({ "domain-list-id": domainListId }) => cmdSignupPageSearch(domainListId)
    )
    .demandCommand(1, "You must provide a valid command.")
    .help()
    .alias("help", "h")
    .version("1.0.0")
    .alias("version", "v")
    .strict().argv;
}

main();
