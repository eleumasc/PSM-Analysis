import DB, { Database } from "better-sqlite3";
import path from "path";
import { readFileSync } from "fs";
import { rootDir } from "../rootDir";

export type Rowid = number | bigint;

export const DB_FILEPATH = path.join(rootDir, "psm-analysis.sqlite");

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

  readDomainList(domainListId: Rowid) {
    const { db } = this;

    const stmtSelect = db.prepare(
      "SELECT * FROM domains WHERE domain_list = ? ORDER BY rank"
    );
    return stmtSelect.all(domainListId).map((row: any) => ({
      id: row["id"] as Rowid,
      domain: row["domain"] as string,
    }));
  }

  createSignupPageSearch(domainListId: Rowid): Rowid {
    const { db } = this;

    const stmtInsert = db.prepare(
      "INSERT INTO signup_page_searches (domain_list) VALUES (?)"
    );
    return stmtInsert.run(domainListId).lastInsertRowid;
  }

  createSignupPageSearchResult(
    signupPageSearchId: Rowid,
    domainId: Rowid,
    detail: any
  ): Rowid {
    const { db } = this;

    const stmtInsert = db.prepare(
      "INSERT INTO signup_page_search_results (signup_page_search, domain, detail) VALUES (?, ?, ?)"
    );
    return stmtInsert.run(signupPageSearchId, domainId, JSON.stringify(detail))
      .lastInsertRowid;
  }
}
