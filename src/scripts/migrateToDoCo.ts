import currentTime from "../util/currentTime";
import Database from "better-sqlite3";
import toSimplifiedURL from "../util/toSimplifiedURL";
import { Completion, isFailure, Success } from "../util/Completion";
import { detectPSM } from "../core/psm/detectPSM";
import { getIPFAbstractResultFromIPFResult } from "../core/psm/InputPasswordFieldAbstractResult";
import { mayDetectPSM } from "../core/psm/mayDetectPSM";
import { openDoCo } from "../core/DoCo";
import { REGISTER_PAGES_COLLECTION_TYPE } from "../commands/cmdSearchRegisterPage";
import { SearchRegisterPageResult } from "../core/searchRegisterPage";
import {
  ChunkedPSMAnalysisResult,
  PSM_ANALYSIS_COLLECTION_TYPE,
} from "../commands/cmdAnalyze";
import {
  SITES_COLLECTION_TYPE,
  SITES_DOCUMENT_NAME,
} from "../commands/cmdLoadSiteList";

const ARGS = process.argv.slice(2);
const EXCLUDE_PSM_ANALYSIS = false; // default: false

const SOURCE_FILE = ARGS[0];

const OUTPUT_FILE = ARGS[1];

function main() {
  const db = new Database(SOURCE_FILE);

  const dc = openDoCo(OUTPUT_FILE);

  // 1. migrate sites
  const sitesFilename = (
    db
      .prepare(
        "SELECT source_filename AS filename FROM domain_lists WHERE id = 1"
      )
      .get() as any
  ).filename as string;
  const sites = db
    .prepare("SELECT name FROM domains WHERE domain_list = 1 ORDER BY rank")
    .all()
    .map(({ name }: any) => name as string);

  const sitesCollection = dc.createCollection(null, sitesFilename, {
    type: SITES_COLLECTION_TYPE,
  });
  dc.createDocument(sitesCollection.id, SITES_DOCUMENT_NAME, sites);

  // 2. create collection for register pages from analysis 1
  const registerPageSiteMap = new Map<string, string>();
  const registerPagesCollection = dc.createCollection(
    sitesCollection.id,
    currentTime().toString(),
    { type: REGISTER_PAGES_COLLECTION_TYPE }
  );
  for (const { site_id: siteId, site, data: dataJson } of db
    .prepare(
      `
SELECT d.id AS site_id, d.name AS site, r.detail AS data
FROM analysis_results r
JOIN domains d ON d.id = r.domain
WHERE analysis = 1
`
    )
    .all() as { site_id: string; site: string; data: string }[]) {
    const oldCompletion = JSON.parse(dataJson) as Completion<any>;
    const newCompletion = (() => {
      if (isFailure(oldCompletion)) return oldCompletion;
      const {
        value: { signupPageUrl: registerPageUrl, ...rest },
      } = oldCompletion;
      return Success<SearchRegisterPageResult>({ registerPageUrl, ...rest });
    })();
    dc.createDocument(registerPagesCollection.id, site, newCompletion);

    if (isFailure(newCompletion)) continue;
    const {
      value: { registerPageUrl },
    } = newCompletion;
    if (registerPageUrl === null) continue;

    const registerPageKey = toSimplifiedURL(registerPageUrl).toString();
    if (registerPageSiteMap.has(registerPageKey)) continue;
    registerPageSiteMap.set(registerPageKey, siteId);
  }

  if (EXCLUDE_PSM_ANALYSIS) return;

  // create collection for PSM analysis from analyses 2 & 3 (result type changed)
  const psmAnalysisCollection = dc.createCollection(
    registerPagesCollection.id,
    currentTime().toString(),
    { type: PSM_ANALYSIS_COLLECTION_TYPE }
  );
  for (const [registerPageKey, siteId] of registerPageSiteMap.entries()) {
    const { data: probeDataJson } = db
      .prepare(
        "SELECT detail as data FROM analysis_results WHERE analysis = 2 AND domain = ?"
      )
      .get([siteId]) as { data: string };
    const probeCompletion = JSON.parse(probeDataJson) as Completion<any>;
    const { data: queryDataJson } = db
      .prepare(
        "SELECT detail as data FROM analysis_results WHERE analysis = 3 AND domain = ?"
      )
      .get([siteId]) as { data: string };
    const queryCompletion = JSON.parse(queryDataJson) as Completion<any>;
    const psmAnalysisCompletion = ((): Completion<ChunkedPSMAnalysisResult> => {
      if (isFailure(probeCompletion)) return probeCompletion;
      const {
        value: { ipfResultPre: testIpfResult, ipfResult: detectIpfResult },
      } = probeCompletion;

      dc.createDocument(
        psmAnalysisCollection.id,
        `test:${registerPageKey}`,
        testIpfResult
      );
      const ipfHint = mayDetectPSM(
        getIPFAbstractResultFromIPFResult(testIpfResult)
      );
      if (!ipfHint) {
        return Success<ChunkedPSMAnalysisResult>({
          testChunkExists: true,
        });
      }

      dc.createDocument(
        psmAnalysisCollection.id,
        `detect:${registerPageKey}`,
        detectIpfResult
      );
      const psmDetected = detectPSM(
        getIPFAbstractResultFromIPFResult(detectIpfResult)
      );
      if (!psmDetected) {
        return Success<ChunkedPSMAnalysisResult>({
          testChunkExists: true,
          detectChunkExists: true,
        });
      }

      if (isFailure(queryCompletion)) return queryCompletion;
      const {
        value: { ipfResult: analysisIpfResult },
      } = queryCompletion;

      dc.createDocument(
        psmAnalysisCollection.id,
        `analysis0:${registerPageKey}`,
        analysisIpfResult
      );
      return Success<ChunkedPSMAnalysisResult>({
        testChunkExists: true,
        detectChunkExists: true,
        analysisChunkExists: true,
        analysisChunksCount: 1,
      });
    })();
    dc.createDocument(
      psmAnalysisCollection.id,
      registerPageKey,
      psmAnalysisCompletion
    );
  }
}

main();
