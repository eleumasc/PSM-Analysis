import _ from "lodash";
import assert from "assert";
import { Completion, isFailure, Success } from "../util/Completion";
import { copyFileSync } from "fs";
import { OldPSMAnalysisResult as OldPSMAnalysisResult } from "./migrateToDoCo";
import { openDoCo } from "../core/DoCo";
import {
  CHUNKS_COLLECTION_NAME,
  PSMAnalysisResult,
} from "../commands/cmdAnalyze";

const ARGS = process.argv.slice(2);

const SOURCE_FILE = ARGS[0];
const OUTPUT_FILE = ARGS[1];

function main() {
  copyFileSync(SOURCE_FILE, OUTPUT_FILE);

  const dc = openDoCo(OUTPUT_FILE);

  const psmAnalysisCollection = dc.getCollectionById(3);

  const allDocuments = dc.getDocumentsByCollection(psmAnalysisCollection.id);
  const chunkDocuments = allDocuments.filter(({ name }) =>
    name.match(/^(test|detect|analysis[0-9]+):/)
  );
  const resultDocuments = _.difference(allDocuments, chunkDocuments);

  const chunksCollection = dc.createCollection(
    psmAnalysisCollection.id,
    CHUNKS_COLLECTION_NAME
  );
  for (const document of chunkDocuments) {
    dc.db
      .prepare(`UPDATE documents SET collection = ? WHERE id = ?`)
      .run([chunksCollection.id, document.id]);
  }

  for (const { id: documentId, name: registerPageKey } of resultDocuments) {
    const oldPsmAnalysisCompletion = dc.getDocumentData(
      documentId
    ) as Completion<OldPSMAnalysisResult>;

    const getChunkKey = (chunkKeyPrefix: string): string =>
      `${chunkKeyPrefix}:${registerPageKey}`;

    const newPsmAnalysisResult = ((): PSMAnalysisResult => {
      let result: PSMAnalysisResult = {};

      const testChunkKey = getChunkKey("test");
      const testChunkDocument = dc.findDocumentByName(
        chunksCollection.id,
        testChunkKey
      );
      if (!testChunkDocument) {
        assert(isFailure(oldPsmAnalysisCompletion));
        return { ...result, testCompletion: oldPsmAnalysisCompletion };
      }
      result = {
        ...result,
        testCompletion: Success({ chunkKey: testChunkKey }),
      };

      const detectChunkKey = getChunkKey("detect");
      const detectChunkDocument = dc.findDocumentByName(
        chunksCollection.id,
        detectChunkKey
      );
      if (!detectChunkDocument) {
        if (isFailure(oldPsmAnalysisCompletion)) {
          return { ...result, detectCompletion: oldPsmAnalysisCompletion };
        } else {
          return result;
        }
      }
      result = {
        ...result,
        detectCompletion: Success({ chunkKey: detectChunkKey }),
      };

      if (isFailure(oldPsmAnalysisCompletion)) {
        return { ...result, analysisCompletion: oldPsmAnalysisCompletion };
      }
      const {
        value: { analysisChunkExists, analysisChunksCount },
      } = oldPsmAnalysisCompletion;
      if (!analysisChunkExists) {
        return result;
      }
      const analysisChunkKeys = Array.from(
        Array(analysisChunksCount),
        (_, i) => i
      ).map((i) => getChunkKey(`analysis${i}`));
      assert(
        analysisChunkKeys.every((key) =>
          Boolean(dc.findDocumentByName(chunksCollection.id, key))
        )
      );
      result = {
        ...result,
        analysisCompletion: Success({
          chunkKeys: analysisChunkKeys,
        }),
      };

      return result;
    })();

    dc.db
      .prepare("UPDATE documents SET data = ? WHERE id = ?")
      .run([JSON.stringify(newPsmAnalysisResult), documentId]);
  }
}

main();
