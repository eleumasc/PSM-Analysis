import _ from "lodash";
import { openDoCo } from "../core/DoCo";
import {
  InputPasswordFieldDetail,
  InputPasswordFieldResult,
  Trace,
} from "../core/InputPasswordFieldResult";
import {
  CHUNKS_COLLECTION_NAME,
  PSM_ANALYSIS_COLLECTION_TYPE,
} from "../commands/cmdAnalyze";

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
    const fixedData = isChunksCollection ? fixIpfResult(data) : data;
    dcDst.importDocument(document, fixedData);
  }
}

function fixIpfResult(
  ipfResult: InputPasswordFieldResult
): InputPasswordFieldResult {
  return ipfResult.map((ipfDetail) => fixIpfDetail(ipfDetail));
}

function fixIpfDetail(src: InputPasswordFieldDetail): InputPasswordFieldDetail {
  const { password, fillTrace, blurTrace } = src;
  return {
    password,
    fillTrace: fillTrace && fixTrace(fillTrace, password),
    blurTrace: blurTrace && fixTrace(blurTrace, password),
  };
}

function fixTrace(src: Trace, password: string): Trace {
  const { functionCalls, xhrRequests, mutationKeys } = src;
  return {
    functionCalls,
    xhrRequests: xhrRequests.filter((xhrRequest) => {
      const { url, body } = xhrRequest;
      return (
        url.includes(encodeURIComponent(password)) ||
        body.includes(password) ||
        body.includes(JSON.stringify(password)) ||
        body.includes(encodeURIComponent(password))
      );
    }),
    mutationKeys,
  };
}
