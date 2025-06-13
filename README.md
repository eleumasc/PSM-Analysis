# PSM Analysis

A tool for the automated analysis of deployed Password Strength Meters (PSMs).

## System requirements

- Node.js 20 or above
- SQLite 3 or above

## Setup

1. Clone this repository: `git clone https://github.com/eleumasc/PSM-Analysis && cd PSM-Analysis`
2. Install the dependencies: `npm i`
3. Run the init script: `npm run init`
4. Build: `npm run build`
5. Choose a password dataset and store it in the project root with name `dataset.json` (see details in Section "Password Datasets")

## How to use

The tool performs the analysis in stages. Each stage generates a collection in the database (the default location is the "psm-analysis.sqlite" file in the project root), which serves as the input for the subsequent stages.

In the following, execute each command by running `npm run start -- <command>`.

1. Load a site list: `load-site-list <filepath>`
   - `filepath`: Path to the file containing the site list. The list should be in the format of [Tranco](https://tranco-list.eu/).
   - **Output**: ID of the generated sites collection.
   - **Effect**: It creates the database file in the project root if it does not exist.
   - **Effect**: It creates a sites collection in the database.
2. Search the registration page on each site: `search-register-page <sites-id>`
   - `sites-id`: ID of the sites collection.
   - `--max-tasks`: Max number of concurrent tasks (NOTE: one running browser per task).
   - `--no-headless-browser`: Run browsers in headful mode.
   - **Output**: ID of the generated register pages collection.
   - **Effect**: It creates a register pages collection in the database.
3. Run PSM analysis on each registration page detected: `analyze <register-pages-id>`
   - `register-pages-id`: ID of the register pages collection.
   - `--max-tasks`: Max number of concurrent tasks (NOTE: one running browser per task).
   - `--max-instrument-workers`: Max number of workers for script instrumentation (NOTE: instrument workers are not shared among tasks -- each task has its own set of instrument workers, whose size is bounded by this parameter).
   - `--no-headless-browser`: Run browsers in headful mode.
   - **Output**: ID of the generated PSM analysis collection.
   - **Effect**: It creates a PSM analysis collection in the database.
4. Perform data processing from a PSM analysis: `measure <psm-analysis-id>`
   - `psm-analysis-id`: ID of the PSM analysis collection.
   - `db-filepath`: Path to the database file (can be different from the default location).
   - **Output**: Nothing.
   - **Effect**: It creates a report file with name "report.json".

Useful tips:

- Analyses initiated by the `search-register-page` or `analyze` command can be resumed after an interruption by running `<command>:resume <output-id>`, where `output-id` is the ID of the analysis to resume.
- Execute a command with the `--help` option to print the command usage.

## Password Datasets

To perform a full PSM analysis, a *golden* password dataset is required. This consists of passwords chosen by real users (e.g., obtained from an existing password leak).

For ethical and legal reasons, we cannot publish the golden password dataset used in our experiments. However, interested researchers may request access by opening an issue in this repository. **Redistribution of the golden dataset is strictly prohibited.**

Alternatively, it is possible to create a personal golden password dataset. It should be formatted as a JSON array of arrays, where each inner array contains two elements: the first (at index `0`) is the password (a string), and the second (at index `1`) is the frequency count of that password (a non-negative integer). Based on our research, we recommend selecting 1,000 unique passwords with frequency counts of at least 10, with as much variability as possible.

For reproducibility, it is possible to distribute redacted versions of databases, i.e., versions cleansed of sensitive passwords from the golden dataset. In such redacted versions, each password from the golden dataset is replaced with a corresponding placeholder that preserves relevant syntactic features but does not otherwise depend on the original. We refer to the dataset containing these placeholders as the *public* password dataset.

A redacted database can be used solely to replicate data processing (`measure` command). To do so, it must be accompanied by the public password dataset derived from the same golden dataset used to produce the original, non-redacted database.

## Data

The database from our first large-scale analysis (April 2025) is available [here](https://drive.google.com/file/d/1Krj4uZb44CinSCSq2SLUcF_JhokZ_BfC/view?usp=sharing). Note that the database has been redacted, so it can only be used to replicate the data processing step (`measure` command) using the public password dataset provided in this repository (i.e., the `first-dataset-pub.json` file located in the `misc` directory).

## Support

Feel free to open an issue or send a pull request. We will try to sort it as soon as possible.
