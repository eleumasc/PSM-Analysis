export type PasswordFieldInputResult = PasswordFieldInputResultRecord[];

export type PasswordFieldInputResultRecord = {
  password: string;
  fillTrace: AnalysisTrace;
  blurTrace: AnalysisTrace;
};

export type AnalysisTrace = {
  functionCalls: FunctionCall[];
  xhrRequests: XHRRequest[];
  incState: IncState;
};

export type FunctionCall = {
  sourceLoc: SourceLoc;
  ret: SerializableValue;
};

export type XHRRequest = {
  method: string;
  url: string;
  body: string;
  status: number;
  responseText: string;
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

export type IncState = { key: string; value: string }[];

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
