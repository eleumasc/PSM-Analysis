import assert from "assert";
import DB, { Database } from "better-sqlite3";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS collections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  parent INTEGER,
  name TEXT NOT NULL,
  meta JSON,

  FOREIGN KEY (parent) REFERENCES collections (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  collection INTEGER NOT NULL,
  name TEXT NOT NULL,
  data JSON NOT NULL,

  FOREIGN KEY (collection) REFERENCES collections (id) ON DELETE CASCADE
);
`;

export default class DoCoLite {
  constructor(protected readonly db: Database) {}

  static open(dbFilepath?: string): DoCoLite {
    const db = new DB(dbFilepath);
    db.exec(SCHEMA);
    return new DoCoLite(db);
  }

  createCollection(
    parentId: number | null,
    name: string,
    meta?: any
  ): Collection {
    const { db } = this;
    const stmt = db.prepare(
      "INSERT INTO collections (parent, name, meta) VALUES (?, ?, ?)"
    );
    const id = stmt.run([parentId, name, meta ? JSON.stringify(meta) : null])
      .lastInsertRowid as number;
    return this.findCollectionById(id);
  }

  findCollectionById(id: number): Collection {
    const { db } = this;
    const stmt = db.prepare("SELECT * FROM collections WHERE id = ?");
    const row = stmt.get([id]);
    if (!row) {
      throw new Error(`Collection with ID ${id} does not exist`);
    }
    return _toCollection(row);
  }

  findCollectionByName(parentId: number | null, name: string): Collection {
    const { db } = this;
    let row;
    if (parentId !== null) {
      const stmt = db.prepare(
        "SELECT * FROM collections WHERE parent = ? AND name = ?"
      );
      row = stmt.get([parentId, name]);
    } else {
      const stmt = db.prepare(
        "SELECT * FROM collections WHERE parent IS NULL AND name = ?"
      );
      row = stmt.get([name]);
    }
    if (!row) {
      throw new Error(`Root collection with name '${name}' does not exist`);
    }
    return _toCollection(row);
  }

  createDocument(collectionId: number, name: string, data: any): Document {
    const { db } = this;
    const stmt = db.prepare(
      "INSERT INTO documents (collection, name, data) VALUES (?, ?, ?)"
    );
    const id = stmt.run([collectionId, name, JSON.stringify(data)])
      .lastInsertRowid as number;
    return this.findDocumentById(id);
  }

  getDocumentData(documentId: number): any {
    const { db } = this;
    const stmt = db.prepare("SELECT data FROM documents WHERE id = ?");
    const row = stmt.get([documentId]);
    if (!row) {
      throw new Error(`Document with ID ${documentId} does not exist`);
    }
    const { data } = row as any;
    assert(typeof data === "string");
    return JSON.parse(data);
  }

  findDocumentById(id: number): Document {
    const { db } = this;
    const stmt = db.prepare(
      "SELECT id, collection, name FROM documents WHERE id = ?"
    );
    const row = stmt.get([id]);
    if (!row) {
      throw new Error(`Document with ID ${id} does not exist`);
    }
    return _toDocument(row);
  }

  findDocumentByName(collectionId: number, name: string): Document {
    const { db } = this;
    const stmt = db.prepare(
      "SELECT id, collection, name FROM documents WHERE collection = ? AND name = ?"
    );
    const row = stmt.get([collectionId, name]);
    if (!row) {
      throw new Error(
        `Document with name '${name}' does not exist in collection with ID ${collectionId}`
      );
    }
    return _toDocument(row);
  }

  getDocumentsByCollection(collectionId: number): Document[] {
    const { db } = this;
    const stmt = db.prepare(
      "SELECT id, collection, name FROM documents WHERE collection = ?"
    );
    const rows = stmt.all([collectionId]);
    return rows.map((row) => _toDocument(row));
  }
}

export interface Collection {
  id: number;
  parentId: number | null;
  name: string;
  meta: any;
}

function _toCollection(row: any): Collection {
  const { id, parent: parentId, name, meta } = row;
  assert(typeof id === "number");
  assert(typeof parentId === "number" || parentId === null);
  assert(typeof name === "string");
  assert(typeof meta === "string" || meta === null);
  return { id, parentId, name, meta: meta ? JSON.parse(meta) : null };
}

export interface Document {
  id: number;
  collectionId: number;
  name: string;
}

function _toDocument(row: any) {
  const { id, collection: collectionId, name } = row;
  assert(typeof id === "number");
  assert(typeof collectionId === "number");
  assert(typeof name === "string");
  return { id, collectionId, name };
}
