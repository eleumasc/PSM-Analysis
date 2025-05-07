export type InputPasswordFieldResult = InputPasswordFieldDetail[];

export type InputPasswordFieldDetail = {
  password: string;
  fillTrace?: Trace;
  blurTrace?: Trace;
};

export type Trace = {
  functionCalls: FunctionCall[];
  xhrRequests: XHRRequest[];
  mutationKeys: MutationKey[];
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
      constructor: string | null;
      value: Record<string, SerializableValue> | null;
    }
  | { type: "function"; id: number };

export type MutationKey = string;
