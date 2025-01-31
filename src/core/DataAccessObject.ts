import assert from "assert";
import DB, { Database } from "better-sqlite3";
import path from "path";
import { readFileSync } from "fs";
import { rootDir } from "../rootDir";

const DB_FILEPATH = path.join(rootDir, "psm-analysis.sqlite");

export type Rowid = number | bigint;

export default class DataAccessObject {
  constructor(readonly db: Database) {}

  static create(dbFilepath?: string): DataAccessObject {
    const schema = readFileSync(path.join(rootDir, "schema.sql")).toString();
    const db = new DB(dbFilepath ?? DB_FILEPATH);
    db.exec(schema);
    return new DataAccessObject(db);
  }

  static open(dbFilepath?: string): DataAccessObject {
    const db = new DB(dbFilepath ?? DB_FILEPATH, { fileMustExist: true });
    return new DataAccessObject(db);
  }

  createDomainList(filename: string, domainNames: string[]): Rowid {
    const { db } = this;

    return db.transaction(() => {
      const stmtDomainListInsert = db.prepare(
        "INSERT INTO domain_lists (source_filename) VALUES (?)"
      );
      const domainListId = stmtDomainListInsert.run([filename]).lastInsertRowid;

      const domainRows = domainNames.map((domainName, i) => [
        domainListId,
        i + 1,
        domainName,
      ]);

      const stmtDomainInsert = db.prepare(
        "INSERT INTO domains (domain_list, rank, name) VALUES (?, ?, ?)"
      );
      for (const domainRow of domainRows) {
        stmtDomainInsert.run(domainRow);
      }

      return domainListId;
    })();
  }

  getDomains(domainListId: Rowid): DomainModel[] {
    const { db } = this;

    const stmtSelect = db.prepare(
      "SELECT * FROM domains WHERE domain_list = ? ORDER BY rank"
    );
    return stmtSelect.all(domainListId).map(toDomainModel);
  }

  createTopAnalysis(type: string, domainListId: Rowid): Rowid {
    const { db } = this;

    const stmtInsert = db.prepare(
      "INSERT INTO analyses (type, domain_list) VALUES (?, ?)"
    );
    return stmtInsert.run(type, domainListId).lastInsertRowid;
  }

  createSubAnalysis(type: string, parentId: Rowid, parentType: string): Rowid {
    const { db } = this;

    const parentAnalysis = this.getAnalysis(parentId);
    checkAnalysisType(parentAnalysis, parentType);

    const stmtInsert = db.prepare(
      "INSERT INTO analyses (type, parent) VALUES (?, ?)"
    );
    return stmtInsert.run(type, parentId).lastInsertRowid;
  }

  getAnalysis(id: Rowid): AnalysisModel {
    const { db } = this;

    const stmtSelect = db.prepare("SELECT * FROM analyses WHERE id = ?");
    const row = stmtSelect.get(id);

    assert(row, `Analysis not found with ID: ${id}`);

    return toAnalysisModel(row);
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

  getAnalysisResult(analysisId: Rowid, domainId: Rowid) {
    const { db } = this;

    const stmtSelect = db.prepare(
      "SELECT * FROM analysis_results WHERE analysis = ? AND domain = ?"
    );
    const row = stmtSelect.get(analysisId, domainId);

    assert(
      row,
      `AnalysisResult not found (Analysis ID: ${analysisId}, Domain ID: ${domainId})`
    );

    return JSON.parse((row as any)["detail"]);
  }

  getTodoDomains(
    analysisId: Rowid,
    expectedAnalysisType: string
  ): DomainModel[] {
    const { db } = this;

    const analysisModel = this.getAnalysis(analysisId);
    checkAnalysisType(analysisModel, expectedAnalysisType);

    if (analysisModel.domainListId !== null) {
      return db
        .prepare(
          [
            "SELECT d.*",
            "FROM domains d",
            "JOIN analyses a ON a.domain_list = d.domain_list",
            "LEFT JOIN analysis_results r ON r.domain = d.id AND r.analysis = a.id",
            "WHERE a.id = ? AND r.id IS NULL",
          ].join(" ")
        )
        .all(analysisId)
        .map(toDomainModel);
    } else {
      assert(analysisModel.parentAnalysisId !== null);
      return db
        .prepare(
          [
            "SELECT d.*",
            "FROM domains d",
            "JOIN analysis_results p ON p.domain = d.id",
            "JOIN analyses a ON a.parent = p.analysis",
            "LEFT JOIN analysis_results r ON r.domain = d.id AND r.analysis = a.id",
            "WHERE a.id = ? AND r.id IS NULL",
          ].join(" ")
        )
        .all(analysisId)
        .map(toDomainModel);
    }
  }

  getDoneDomains(analysisId: Rowid): DomainModel[] {
    const { db } = this;

    return db
      .prepare(
        [
          "SELECT d.*",
          "FROM domains d",
          "JOIN analysis_results r ON r.domain = d.id",
          "WHERE r.analysis = ?",
        ].join(" ")
      )
      .all(analysisId)
      .map(toDomainModel);
  }
}

export type DomainModel = {
  id: Rowid;
  rank: number;
  name: string;
};

function toDomainModel(row: any): DomainModel {
  const { id, rank, name } = row;
  return {
    id,
    rank,
    name,
  };
}

export type AnalysisModel = {
  id: Rowid;
  type: string;
  domainListId: Rowid | null;
  parentAnalysisId: Rowid | null;
};

function toAnalysisModel(row: any): AnalysisModel {
  const { id, type, domain_list: domainListId, parent: parentAnalysisId } = row;
  return {
    id,
    type,
    domainListId,
    parentAnalysisId,
  };
}

export function checkAnalysisType(
  analysisModel: AnalysisModel,
  expectedType: string
): void {
  assert(
    analysisModel.type === expectedType,
    `Expected ${expectedType}, but got ${analysisModel.type} (Analysis ID: ${analysisModel.id})`
  );
}
