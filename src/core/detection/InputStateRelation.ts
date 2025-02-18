import _ from "lodash";

export type InputStateRelation = InputStateRelationEntry[];

export type InputStateRelationEntry = {
  input: number;
  state: State;
};

export type State = StateEntry[];

export type StateEntry = {
  key: string;
  value: string;
};

export function findFunctionalStateKeys(
  relation: InputStateRelation
): string[] {
  const keyMap = new Map<string, Map<number, string>>();

  for (const entry of relation) {
    const { input, state } = entry;
    for (const { key, value } of state) {
      if (!keyMap.has(key)) {
        keyMap.set(key, new Map());
      }
      const inputMap = keyMap.get(key)!;

      if (inputMap.has(input) && inputMap.get(input) !== value) {
        keyMap.delete(key);
      } else {
        inputMap.set(input, value);
      }
    }
  }

  return Array.from(keyMap.keys());
}
