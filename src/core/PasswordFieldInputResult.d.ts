export type PasswordFieldInputResult = {
  functionCalls: FunctionCall[];
  mutations: Mutation[];
};

export type FunctionCall = {
  sourceLoc: SourceLoc;
  args: SerializableValue[];
  ret?: { v: SerializableValue };
  exc?: { e: SerializableValue };
};

export type Mutation =
  | {
      type: "attributes";
      target: SerializableValue;
      attributeName: string;
      value: string;
      oldValue: string;
    }
  | {
      type: "characterData";
      target: SerializableValue;
      value: string;
      oldValue: string;
    }
  | {
      type: "childList";
      target: SerializableValue;
      addedNodes: SerializableValue[];
      removedNodes: SerializableValue[];
      addedTexts: string[];
      removedTexts: string[];
    };

export type SourceLoc = [string, number, number];

export type SerializableValue =
  | boolean
  | bigint
  | number
  | string
  | undefined
  | null
  | { type: "symbol"; description: string }
  | { type: "RegExp"; pattern: string }
  | { type: "Array"; id: number; value: SerializableValue[] | null }
  | {
      type: "object";
      id: number;
      constructor: string;
      value: Record<string, SerializableValue> | null;
    }
  | { type: "function"; id: number };
