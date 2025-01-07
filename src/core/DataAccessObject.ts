import DB, { Database } from "better-sqlite3";
import path from "path";
import { readFileSync } from "fs";
import { rootDir } from "../rootDir";

const DB_FILEPATH = path.join(rootDir, "psm-analysis.sqlite");

export type Rowid = number | bigint;

export type DomainEntry = {
  id: Rowid;
  domain: string;
};

export default class DataAccessObject {
  constructor(readonly db: Database) {}

  static create(): DataAccessObject {
    const schema = readFileSync(path.join(rootDir, "schema.sql")).toString();
    const db = new DB(DB_FILEPATH);
    db.exec(schema);
    return new DataAccessObject(db);
  }

  static open(): DataAccessObject {
    const db = new DB(DB_FILEPATH, { fileMustExist: true });
    return new DataAccessObject(db);
  }

  createDomainList(filename: string, domains: string[]): Rowid {
    const { db } = this;

    return db.transaction(() => {
      const stmtDomainListInsert = db.prepare(
        "INSERT INTO domain_lists (source_filename) VALUES (?)"
      );
      const domainListId = stmtDomainListInsert.run([filename]).lastInsertRowid;

      const domainRows = domains.map((domain, i) => [
        domainListId,
        i + 1,
        domain,
      ]);

      const stmtDomainInsert = db.prepare(
        "INSERT INTO domains (domain_list, rank, domain) VALUES (?, ?, ?)"
      );
      for (const domainRow of domainRows) {
        stmtDomainInsert.run(domainRow);
      }

      return domainListId;
    })();
  }

  readDomainList(domainListId: Rowid): DomainEntry[] {
    const { db } = this;

    const stmtSelect = db.prepare(
      "SELECT * FROM domains WHERE domain_list = ? ORDER BY rank"
    );
    return stmtSelect.all(domainListId).map((row: any) => ({
      id: row["id"] as Rowid,
      domain: row["domain"] as string,
    }));
  }

  createAnalysis(type: string, domainListId: Rowid): Rowid {
    const { db } = this;

    const stmtInsert = db.prepare(
      "INSERT INTO analyses (type, domain_list) VALUES (?, ?)"
    );
    return stmtInsert.run(type, domainListId).lastInsertRowid;
  }

  createAnalysisResult(
    analysisId: Rowid,
    domainId: Rowid,
    detail: any,
    timeInfo?: { startTime: number; endTime: number }
  ): Rowid {
    const { db } = this;

    const stmtInsert = db.prepare(
      "INSERT INTO analysis_results (analysis, domain, detail, start_time, end_time) VALUES (?, ?, ?, ?, ?)"
    );
    return stmtInsert.run(
      analysisId,
      domainId,
      JSON.stringify(detail),
      timeInfo?.startTime,
      timeInfo?.endTime
    ).lastInsertRowid;
  }
}
