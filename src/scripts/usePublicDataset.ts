import { copyFileSync } from "fs";

// IMPORTANT! The public dataset allows one to replicate data processing
// (cmdMeasure) on redacted databases. However, it does not allow to reproduce
// PSM analysis (cmdAnalyze), since the passwords used are those from the
// actual dataset. The latter dataset contains passwords created by real users,
// which we do not publish for ethical and legal reasons.
//
// If interested to perform PSM analysis using the actual dataset, feel free to
// send a request to authors.
// Re-distribution of the actual dataset is strictly forbidden!

copyFileSync("dataset-pub.json", "dataset.json");
