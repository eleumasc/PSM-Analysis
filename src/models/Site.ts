import assert from "assert";

export interface Site {
  id?: number;
  name: string;
  rank: number;
}

export function SiteConstructor(record: any): Site {
  const { id, name, rank } = record;
  assert(typeof id === "number");
  assert(typeof name === "string");
  assert(typeof rank === "number");
  return { id, name, rank };
}
