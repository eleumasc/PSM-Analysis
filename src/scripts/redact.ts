import _ from "lodash";
import assert from "assert";
import toSimplifiedURL from "../util/toSimplifiedURL";
import { DatasetEntry } from "../data/passwords";
import { openDoCo } from "../core/DoCo";
import { readFileSync } from "fs";
import {
  getAbstractCallsFromFunctionCall,
  getAbstractCallsFromXHRRequest,
} from "../core/psm/InputPasswordFieldAbstractResult";
import {
  FunctionCall,
  InputPasswordFieldDetail,
  InputPasswordFieldResult,
  Trace,
  XHRRequest,
} from "../core/InputPasswordFieldResult";
import {
  CHUNKS_COLLECTION_NAME,
  PSM_ANALYSIS_COLLECTION_TYPE,
} from "../commands/cmdAnalyze";

const goldenEntries = JSON.parse(
  readFileSync("dataset.json", "utf8")
) as DatasetEntry[];

const publicEntries = JSON.parse(
  readFileSync("dataset-pub.json", "utf8")
) as DatasetEntry[];
assert(publicEntries.length === goldenEntries.length);

const dcSrc = openDoCo(process.argv[2]);

const dcDst = openDoCo(process.argv[3]);

for (const collection of dcSrc.getAllCollections()) {
  if (!dcDst.findCollectionById(collection.id)) {
    dcDst.importCollection(collection);
  }
  const { name, parentId } = collection;
  const isChunksCollection =
    name === CHUNKS_COLLECTION_NAME &&
    parentId &&
    dcSrc.getCollectionById(parentId).meta?.type ===
      PSM_ANALYSIS_COLLECTION_TYPE;

  for (const document of dcSrc.getDocumentsByCollection(collection.id)) {
    if (dcDst.findDocumentById(document.id)) continue;
    const data = dcSrc.getDocumentData(document.id);
    const redactedData =
      isChunksCollection && /^analysis[0-9]+:/.test(document.name)
        ? redactIpfResult(data)
        : data;
    dcDst.importDocument(document, redactedData);
  }
}

function redactIpfResult(
  ipfResult: InputPasswordFieldResult
): InputPasswordFieldResult {
  return ipfResult.map((ipfDetail) => redactIpfDetail(ipfDetail));
}

function redactIpfDetail(
  src: InputPasswordFieldDetail
): InputPasswordFieldDetail {
  const { password: goldenPassword, fillTrace, blurTrace } = src;
  const passwordIndex = goldenEntries.findIndex(
    ([password]) => password === goldenPassword
  );
  assert(passwordIndex !== -1, `Password not found: ${goldenPassword}`);
  const publicPassword = publicEntries[passwordIndex][0];
  return {
    password: publicPassword,
    fillTrace: fillTrace && redactTrace(fillTrace, publicPassword),
    blurTrace: blurTrace && redactTrace(blurTrace, publicPassword),
  };
}

function redactTrace(src: Trace, publicPassword: string): Trace {
  const { functionCalls, xhrRequests, mutationKeys } = src;
  const result = {
    functionCalls: functionCalls.map((functionCall) =>
      redactFunctionCall(functionCall, publicPassword)
    ),
    xhrRequests: xhrRequests.map((xhrRequest) =>
      redactXHRRequest(xhrRequest, publicPassword)
    ),
    mutationKeys,
  };
  assert(
    _.isEqual(
      functionCalls.map((functionCall) =>
        getAbstractCallsFromFunctionCall(functionCall)
      ),
      result.functionCalls.map((functionCall) =>
        getAbstractCallsFromFunctionCall(functionCall)
      )
    )
  );
  assert(
    _.isEqual(
      xhrRequests.map((xhrRequest) =>
        getAbstractCallsFromXHRRequest(xhrRequest)
      ),
      result.xhrRequests.map((xhrRequest) =>
        getAbstractCallsFromXHRRequest(xhrRequest)
      )
    )
  );
  return result;
}

function redactFunctionCall(
  src: FunctionCall,
  _publicPassword: string
): FunctionCall {
  const { sourceLoc } = src;
  const srcSafe = { sourceLoc };
  const abstractCalls = getAbstractCallsFromFunctionCall(src);
  if (abstractCalls.length > 0) {
    if (Boolean(abstractCalls[0].type.propertyName)) {
      assert(
        abstractCalls.every((abstractCall) =>
          Boolean(abstractCall.type.propertyName)
        )
      );
      const redactedValue = Object.fromEntries(
        abstractCalls.map(
          ({ type: { propertyName: objKey }, value: objValue }) => {
            return [objKey!, objValue];
          }
        )
      );
      return {
        ...srcSafe,
        ret: { type: "object", id: 1, constructor: null, value: redactedValue },
      };
    } else {
      assert(abstractCalls.length === 1);
      return {
        ...srcSafe,
        ret: abstractCalls[0].value,
      };
    }
  } else {
    return {
      ...srcSafe,
      ret: undefined,
    };
  }
}

function redactXHRRequest(src: XHRRequest, publicPassword: string): XHRRequest {
  const { method, url, status } = src;
  const srcSafe = { method, url: toSimplifiedURL(url).toString(), status };
  const abstractCalls = getAbstractCallsFromXHRRequest(src);
  if (abstractCalls.length > 0) {
    if (Boolean(abstractCalls[0].type.propertyName)) {
      assert(
        abstractCalls.every((abstractCall) =>
          Boolean(abstractCall.type.propertyName)
        )
      );
      const redactedResponse = Object.fromEntries(
        abstractCalls.map(
          ({ type: { propertyName: objKey }, value: objValue }) => {
            return [objKey!, objValue];
          }
        )
      );
      return {
        ...srcSafe,
        body: publicPassword,
        responseText: JSON.stringify(redactedResponse),
      };
    } else {
      assert(abstractCalls.length === 1);
      return {
        ...srcSafe,
        body: publicPassword,
        responseText: JSON.stringify(abstractCalls[0].value),
      };
    }
  } else {
    return {
      ...srcSafe,
      body: "",
      responseText: JSON.stringify(null),
    };
  }
}
