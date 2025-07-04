import _ from "lodash";
import assert from "assert";
import buckets from "../util/buckets";
import currentTime from "../util/currentTime";
import installAnalysis from "../core/installAnalysis";
import openDocumentStore from "../core/openDocumentStore";
import toSimplifiedURL from "../util/toSimplifiedURL";
import useBrowser from "../util/useBrowser";
import useWorker from "../core/worker";
import { bomb } from "../util/timeout";
import { detectPSM } from "../core/psm/detectPSM";
import { getIPFAbstractResultFromIPFResult } from "../core/psm/InputPasswordFieldAbstractResult";
import { InputPasswordFieldResult } from "../core/InputPasswordFieldResult";
import { mayDetectPSM } from "../core/psm/mayDetectPSM";
import { processTaskQueue } from "../util/TaskQueue";
import { REGISTER_PAGES_COLLECTION_TYPE } from "./cmdSearchRegisterPage";
import { SearchRegisterPageResult } from "../core/searchRegisterPage";
import {
  Completion,
  isFailure,
  Success,
  toCompletion,
} from "../util/Completion";
import {
  getMonotoneTestPasswords,
  getDatasetPasswords,
  TEST_PASSWORD,
} from "../data/passwords";
import inputPasswordField, {
  InputPasswordFieldHint,
} from "../core/inputPasswordField";

export type PSMAnalysisResult = {
  testCompletion?: Completion<{ chunkKey: string }>;
  detectCompletion?: Completion<{ chunkKey: string }>;
  analysisCompletion?: Completion<{ chunkKeys: string[] }>;
};

type RegisterPageEntry = {
  key: string;
  url: string;
};

export const PSM_ANALYSIS_COLLECTION_TYPE = "psm_analysis";

export const CHUNKS_COLLECTION_NAME = "chunks";

const RUN_IPF_TIMEOUT_MS: number = 10 * 60 * 1000; // 10 minutes

const BUCKET_SIZE: number = 50;

export default async function cmdAnalyze(
  args: (
    | {
        action: "create";
        registerPagesId: number;
      }
    | {
        action: "resume";
        outputId: number;
      }
  ) & {
    maxTasks: number;
    maxInstrumentWorkers: number;
    noHeadlessBrowser: boolean;
  }
) {
  const store = openDocumentStore();

  const outputCollection =
    args.action === "create"
      ? store.createCollection(
          (() => {
            const sitesCollection = store.getCollectionById(
              args.registerPagesId
            );
            assert(
              sitesCollection.meta.type === REGISTER_PAGES_COLLECTION_TYPE
            );
            return sitesCollection.id;
          })(),
          currentTime().toString(),
          { type: PSM_ANALYSIS_COLLECTION_TYPE }
        )
      : store.getCollectionById(args.outputId);
  assert(outputCollection.meta.type === PSM_ANALYSIS_COLLECTION_TYPE);
  const registerPagesCollectionId = outputCollection.parentId!;

  const chunksCollection =
    store.findCollectionByName(outputCollection.id, CHUNKS_COLLECTION_NAME) ??
    store.createCollection(outputCollection.id, CHUNKS_COLLECTION_NAME);

  const tbdRegisterPageEntries = _.differenceWith(
    // all register pages
    (() => {
      const registerPages = store
        .getDocumentsByCollection(registerPagesCollectionId)
        .flatMap((document): RegisterPageEntry[] => {
          const completion = store.getDocumentData(
            document.id
          ) as Completion<SearchRegisterPageResult>;
          if (isFailure(completion)) return [];
          const {
            value: { registerPageUrl },
          } = completion;
          if (registerPageUrl === null) return [];
          return [
            {
              key: toSimplifiedURL(registerPageUrl).toString(),
              url: registerPageUrl,
            },
          ];
        });
      return _.uniqBy(registerPages, (x) => x.key);
    })(),
    // processed register pages
    store
      .getDocumentsByCollection(outputCollection.id)
      .map((document) => document.name),
    (x, y) => x.key === y
  );

  console.log(`Output ID: ${outputCollection.id}`);
  console.log(`${tbdRegisterPageEntries.length} register pages remaining`);

  await processTaskQueue(
    tbdRegisterPageEntries,
    { maxTasks: args.maxTasks },
    (registerPageEntry, queueIndex) => async () => {
      const { key: registerPageKey } = registerPageEntry;
      console.log(`begin analysis ${registerPageKey} [${queueIndex}]`);
      const result = await runAnalyze(registerPageEntry, {
        chunkManager: {
          async get(key) {
            const document = store.findDocumentByName(chunksCollection.id, key);
            if (!document) return;
            return store.getDocumentData(document.id);
          },
          async set(key, value) {
            store.createDocument(chunksCollection.id, key, value);
          },
        },
        maxInstrumentWorkers: args.maxInstrumentWorkers,
        headlessBrowser: !args.noHeadlessBrowser,
      });
      console.log(`end analysis ${registerPageKey} [${queueIndex}]`);
      store.createDocument(outputCollection.id, registerPageKey, result);
    }
  );

  process.exit(0);
}

export async function runAnalyze(
  registerPageEntry: RegisterPageEntry,
  options: {
    chunkManager: {
      get: (key: string) => Promise<any | undefined>;
      set: (key: string, value: any) => Promise<void>;
    };
    maxInstrumentWorkers: number;
    headlessBrowser: boolean;
  }
): Promise<PSMAnalysisResult> {
  const { url: registerPageUrl } = registerPageEntry;

  const getChunkKey = (chunkKeyPrefix: string): string =>
    `${chunkKeyPrefix}:${registerPageEntry.key}`;

  return useWorker(
    { maxWorkers: options.maxInstrumentWorkers },
    async (workerExec) => {
      const runIpf = async (
        chunkKey: string,
        passwordList: string[],
        hint?: InputPasswordFieldHint
      ): Promise<InputPasswordFieldResult> => {
        const savedIpfResult = await options.chunkManager.get(chunkKey);
        if (savedIpfResult) {
          console.log(`chunk saved ${chunkKey}`);
          return savedIpfResult;
        }

        const computedIpfResult = await useBrowser(
          { headless: options.headlessBrowser },
          async (browser) => {
            const page = await browser.newPage();
            await installAnalysis(page, { workerExec });
            return bomb(
              () =>
                inputPasswordField(page, {
                  registerPageUrl,
                  passwordList,
                  hint,
                }),
              RUN_IPF_TIMEOUT_MS
            );
          }
        );
        await options.chunkManager.set(chunkKey, computedIpfResult);
        console.log(`chunk computed ${chunkKey}`);
        return computedIpfResult;
      };

      let result: PSMAnalysisResult = {};

      const testChunkKey = getChunkKey("test");
      const testCompletion = await toCompletion(() =>
        runIpf(testChunkKey, [TEST_PASSWORD])
      );
      if (isFailure(testCompletion)) {
        return { ...result, testCompletion };
      }
      result = {
        ...result,
        testCompletion: Success({ chunkKey: testChunkKey }),
      };

      const { value: testIpfResult } = testCompletion;
      const ipfHint = mayDetectPSM(
        getIPFAbstractResultFromIPFResult(testIpfResult)
      );
      if (!ipfHint) {
        return result;
      }

      const detectChunkKey = getChunkKey("detect");
      const detectCompletion = await toCompletion(() =>
        runIpf(
          detectChunkKey,
          [...getMonotoneTestPasswords(), TEST_PASSWORD],
          ipfHint
        )
      );
      if (isFailure(detectCompletion)) {
        return { ...result, detectCompletion };
      }
      result = {
        ...result,
        detectCompletion: Success({ chunkKey: detectChunkKey }),
      };

      const { value: detectIpfResult } = detectCompletion;
      const psmDetected = detectPSM(
        getIPFAbstractResultFromIPFResult(detectIpfResult)
      );
      if (!psmDetected) {
        return result;
      }

      let analysisChunkKeys: string[] = [];
      for (const [bucket, i] of buckets(getDatasetPasswords(), BUCKET_SIZE).map(
        (x, i): [typeof x, number] => [x, i]
      )) {
        const analysisChunkKey = getChunkKey(`analysis${i}`);
        analysisChunkKeys = [...analysisChunkKeys, analysisChunkKey];
        const analysisCompletion = await toCompletion(() =>
          runIpf(analysisChunkKey, bucket, ipfHint)
        );
        if (isFailure(analysisCompletion)) {
          return { ...result, analysisCompletion };
        }
      }
      result = {
        ...result,
        analysisCompletion: Success({ chunkKeys: analysisChunkKeys }),
      };

      return result;
    }
  );
}
