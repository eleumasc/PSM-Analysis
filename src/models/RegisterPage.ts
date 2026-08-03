import assert from "assert";

export interface RegisterPage {
  id?: number;
  url: string;
}

export function RegisterPageConstructor(record: any): RegisterPage {
  const { id, url } = record;
  assert(typeof id === "number");
  assert(typeof url === "string");
  return { id, url };
}
