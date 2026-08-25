import DB, { Database } from "better-sqlite3";
import { Site, SiteConstructor } from "../models/Site";
import { isSuccess, Success } from "../util/Completion";
import toSimplifiedURL from "../util/toSimplifiedURL";
import { RegisterPage, RegisterPageConstructor } from "../models/RegisterPage";
import {
  PSMAnalysisResult,
  PSMAnalysisResultRecord,
} from "../core/PSMAnalysisResult";
import {
  RegisterPageDetectionResult,
  RegisterPageDetectionResultRecord,
} from "../core/RegisterPageDetectionResult";
import assert from "assert";
import { QPFResult } from "../core/QPFResult";
import { toArray } from "iter-tools";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS meta (
  name VARCHAR(256) PRIMARY KEY,
  data TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  rank INTEGER NOT NULL,
  UNIQUE (name)
);
CREATE TABLE IF NOT EXISTS register_page_detection_results (
  site_id INTEGER PRIMARY KEY,
  data JSON NOT NULL,
  register_page_id INTEGER,
  FOREIGN KEY (site_id) REFERENCES sites (id),
  FOREIGN KEY (register_page_id) REFERENCES register_pages (id)
);
CREATE TABLE IF NOT EXISTS register_pages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  url TEXT NOT NULL,
  UNIQUE (url)
);
CREATE TABLE IF NOT EXISTS psm_analysis_results (
  register_page_id INTEGER PRIMARY KEY,
  data JSON NOT NULL,
  FOREIGN KEY (register_page_id) REFERENCES register_pages (id)
);
CREATE TABLE IF NOT EXISTS qpf_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  register_page_id INTEGER NOT NULL,
  step INTEGER NOT NULL,
  password VARCHAR(256) NOT NULL,
  data JSON NOT NULL,
  UNIQUE (register_page_id, step, password),
  FOREIGN KEY (register_page_id) REFERENCES register_pages (id)
);
`;

const QPFResultSteps = {
  TEST: 1,
  DETECT: 2,
  ANALYSIS: 3,
} as const;

export default class DataArchive {
  constructor(readonly db: Database) {}

  static open(dbPath?: string): DataArchive {
    const db = new DB(dbPath);
    db.exec(SCHEMA);
    return new DataArchive(db);
  }

  setMeta(name: string, data: string): void {
    const { db } = this;
    const stmt = db.prepare(
      "INSERT OR REPLACE INTO meta (name, data) VALUES (?, ?)"
    );
    stmt.run([name, data]);
  }

  deleteMeta(name: string): void {
    const { db } = this;
    const stmt = db.prepare("DELETE FROM meta WHERE name = ?");
    stmt.run([name]);
  }

  getMeta(name: string): string | undefined {
    const { db } = this;
    const stmt = db.prepare("SELECT data FROM meta WHERE name = ?");
    return (stmt.get([name]) as any)?.data;
  }

  addSites(sites: Site[]): void {
    if (sites.length === 0) return;
    const { db } = this;
    const stmt = db.prepare("INSERT INTO sites (name, rank) VALUES (?, ?)");
    db.transaction(() => {
      for (const { name, rank } of sites) {
        stmt.run([name, rank]);
      }
    })();
  }

  *getPendingSitesForRegisterPageDetection(): IterableIterator<Site> {
    const { db } = this;
    const stmt = db.prepare(
      "SELECT * FROM sites s WHERE NOT EXISTS (SELECT * FROM register_page_detection_results r WHERE r.site_id = s.id)"
    );
    for (const row of stmt.iterate()) {
      yield SiteConstructor(row);
    }
  }

  completeRegisterPageDetection(
    siteId: number,
    result: RegisterPageDetectionResult
  ): void {
    const { searchCompletion } = result;
    assert(searchCompletion);
    let rpUrl: string | null = null;
    if (isSuccess(searchCompletion)) {
      const { value: r } = searchCompletion;
      rpUrl = r.rpUrl;
    }
    if (rpUrl) {
      rpUrl = toSimplifiedURL(rpUrl).toString();
    }

    const { db } = this;
    db.transaction(() => {
      let rpId: number | null = null;
      if (rpUrl) {
        const stmtInsertRegisterPage = db.prepare(
          "INSERT OR IGNORE INTO register_pages (url) VALUES (?)"
        );
        stmtInsertRegisterPage.run([rpUrl]);

        const stmtSelectRegisterPage = db.prepare(
          "SELECT * FROM register_pages WHERE url = ?"
        );
        rpId = (stmtSelectRegisterPage.get([rpUrl]) as { id: number }).id;
      }

      const stmtInsertRegisterPageDetectionResult = db.prepare(
        "INSERT INTO register_page_detection_results (site_id, data, register_page_id) VALUES (?, ?, ?)"
      );
      stmtInsertRegisterPageDetectionResult.run([
        siteId,
        JSON.stringify(result),
        rpId,
      ]);
    })();
  }

  *getRegisterPageDetectionResultRecordIds(): IterableIterator<number> {
    const { db } = this;

    const stmt = db.prepare(
      "SELECT site_id FROM register_page_detection_results"
    );
    for (const row of stmt.iterate()) {
      const { site_id: siteId } = row as { site_id: number };
      yield siteId;
    }
  }

  getRegisterPageDetectionResultRecord(
    siteId: number
  ): RegisterPageDetectionResultRecord | null {
    const { db } = this;

    const stmt = db.prepare(
      "SELECT * FROM register_page_detection_results r JOIN sites s ON s.id = r.site_id LEFT JOIN register_pages p ON p.id = r.register_page_id WHERE r.site_id = ?"
    );
    const row = stmt.get([siteId]);
    if (!row) {
      return null;
    }

    const {
      data,
      name: siteName,
      rank: siteRank,
      register_page_id: rpId,
      url: rpUrl,
    } = row as {
      data: string;
      name: string;
      rank: number;
      register_page_id: number | null;
      url: string | null;
    };

    const result = JSON.parse(data) as RegisterPageDetectionResult;

    const site: Site = { id: siteId, name: siteName, rank: siteRank };
    const registerPage: RegisterPage | null =
      rpId !== null ? { id: rpId, url: rpUrl! } : null;

    return { result, site, registerPage };
  }

  *getPendingRegisterPagesForPSMAnalysis(): IterableIterator<RegisterPage> {
    const { db } = this;
    const stmt = db.prepare(
      "SELECT * FROM register_pages p WHERE NOT EXISTS (SELECT * FROM psm_analysis_results r WHERE r.register_page_id = p.id)"
    );
    for (const row of stmt.iterate()) {
      yield RegisterPageConstructor(row);
    }
  }

  completePSMAnalysis(rpId: number, result: PSMAnalysisResult): void {
    const { testCompletion, detectCompletion, analysisCompletion } = result;

    const { db } = this;
    db.transaction(() => {
      const stmtInsertQPFResult = db.prepare(
        "INSERT INTO qpf_results (register_page_id, step, password, data) VALUES (?, ?, ?, ?)"
      );
      const insertQPFResult = (step: number, qpfResult: QPFResult) => {
        stmtInsertQPFResult.run([
          rpId,
          step,
          qpfResult.password,
          JSON.stringify(qpfResult),
        ]);
      };

      let $result = result;

      if (testCompletion && isSuccess(testCompletion)) {
        for (const qpfResult of testCompletion.value) {
          insertQPFResult(QPFResultSteps.TEST, qpfResult);
        }
        $result = { ...$result, testCompletion: Success([]) };
      }

      if (detectCompletion && isSuccess(detectCompletion)) {
        for (const qpfResult of detectCompletion.value) {
          insertQPFResult(QPFResultSteps.DETECT, qpfResult);
        }
        $result = { ...$result, detectCompletion: Success([]) };
      }

      if (analysisCompletion && isSuccess(analysisCompletion)) {
        for (const qpfResult of analysisCompletion.value) {
          insertQPFResult(QPFResultSteps.ANALYSIS, qpfResult);
        }
        $result = { ...$result, analysisCompletion: Success([]) };
      }

      const stmtInsertPSMAnalysisResult = db.prepare(
        "INSERT INTO psm_analysis_results (register_page_id, data) VALUES (?, ?)"
      );
      stmtInsertPSMAnalysisResult.run([rpId, JSON.stringify($result)]);
    })();
  }

  *getPSMAnalysisResultRecordIds(): IterableIterator<number> {
    const { db } = this;

    const stmt = db.prepare(
      "SELECT register_page_id FROM psm_analysis_results"
    );
    for (const row of stmt.iterate()) {
      const { register_page_id: registerPageId } = row as {
        register_page_id: number;
      };
      yield registerPageId;
    }
  }

  getPSMAnalysisResultRecord(rpId: number): PSMAnalysisResultRecord | null {
    const { db } = this;

    const stmtSelectPSMAnalysisResult = db.prepare(
      "SELECT * FROM psm_analysis_results r JOIN register_pages p ON p.id = r.register_page_id WHERE r.register_page_id = ?"
    );
    const row = stmtSelectPSMAnalysisResult.get([rpId]);
    if (!row) {
      return null;
    }

    const { data, url: rpUrl } = row as {
      data: string;
      url: string;
    };

    const $result = JSON.parse(data) as PSMAnalysisResult;
    const { testCompletion, detectCompletion, analysisCompletion } = $result;

    const stmtSelectQPFResults = db.prepare(
      "SELECT data FROM qpf_results WHERE register_page_id = ? AND step = ? ORDER BY id"
    );
    const getQPFResultsByStep = function* (
      step: number
    ): IterableIterator<QPFResult> {
      for (const row of stmtSelectQPFResults.iterate([rpId, step])) {
        const { data } = row as { data: string };
        const qpfResult = JSON.parse(data) as QPFResult;
        yield qpfResult;
      }
    };

    let result = $result;

    if (testCompletion && isSuccess(testCompletion)) {
      result = {
        ...result,
        testCompletion: Success(
          toArray(getQPFResultsByStep(QPFResultSteps.TEST))
        ),
      };
    }

    if (detectCompletion && isSuccess(detectCompletion)) {
      result = {
        ...result,
        detectCompletion: Success(
          toArray(getQPFResultsByStep(QPFResultSteps.DETECT))
        ),
      };
    }

    if (analysisCompletion && isSuccess(analysisCompletion)) {
      result = {
        ...result,
        analysisCompletion: Success(
          toArray(getQPFResultsByStep(QPFResultSteps.ANALYSIS))
        ),
      };
    }

    const registerPage: RegisterPage = { id: rpId, url: rpUrl };

    return { result, registerPage };
  }

  getRegisterPageSitesMap(): Map<number, Site[]> {
    const { db } = this;

    const map = new Map<number, Site[]>();

    const stmt = db.prepare(
      "SELECT * FROM register_page_detection_results r JOIN sites s ON s.id = r.site_id WHERE r.register_page_id IS NOT NULL"
    );
    for (const row of stmt.iterate()) {
      const {
        site_id: siteId,
        name: siteName,
        rank: siteRank,
        register_page_id: rpId,
      } = row as {
        site_id: number;
        name: string;
        rank: number;
        register_page_id: number;
      };

      const site: Site = { id: siteId, name: siteName, rank: siteRank };

      map.set(rpId, [...(map.get(rpId) ?? []), site]);
    }

    return map;
  }
}
