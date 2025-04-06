import _ from "lodash";
import assert from "assert";
import buckets from "../util/buckets";
import currentTime from "../util/currentTime";
import installAnalysis from "../core/installAnalysis";
import processTaskQueue from "../util/processTaskQueue";
import toSimplifiedURL from "../util/toSimplifiedURL";
import useBrowser from "../util/useBrowser";
import useWorker from "../core/worker";
import { bomb } from "../util/timeout";
import { Completion, isFailure, toCompletion } from "../util/Completion";
import { detectPSM } from "../core/psm/detectPSM";
import { getIPFAbstractResultFromIPFResult } from "../core/psm/InputPasswordFieldAbstractResult";
import { InputPasswordFieldResult } from "../core/InputPasswordFieldResult";
import { mayDetectPSM } from "../core/psm/mayDetectPSM";
import { openDoCo } from "../core/DoCo";
import { REGISTER_PAGES_COLLECTION_TYPE } from "./cmdSearchRegisterPage";
import { SearchRegisterPageResult } from "../core/searchRegisterPage";
import {
  getMonotoneTestPasswords,
  getRockYou2021Passwords,
  TEST_PASSWORD,
} from "../data/passwords";
import inputPasswordField, {
  InputPasswordFieldHint,
} from "../core/inputPasswordField";

export type PSMAnalysisResult = {
  testIpfResult?: InputPasswordFieldResult;
  detectIpfResult?: InputPasswordFieldResult;
  analysisIpfResult?: InputPasswordFieldResult;
};

export type ChunkedPSMAnalysisResult = {
  testChunkExists?: boolean;
  detectChunkExists?: boolean;
  analysisChunkExists?: boolean;
  analysisChunksCount?: number;
};

type RegisterPageEntry = {
  key: string;
  url: string;
};

export const PSM_ANALYSIS_COLLECTION_TYPE = "psm_analysis";

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
  }
) {
  const dc = openDoCo();

  const outputCollection =
    args.action === "create"
      ? dc.createCollection(
          (() => {
            const sitesCollection = dc.findCollectionById(args.registerPagesId);
            assert(
              sitesCollection.meta.type === REGISTER_PAGES_COLLECTION_TYPE
            );
            return sitesCollection.id;
          })(),
          currentTime().toString(),
          { type: PSM_ANALYSIS_COLLECTION_TYPE }
        )
      : dc.findCollectionById(args.outputId);
  assert(outputCollection.meta.type === PSM_ANALYSIS_COLLECTION_TYPE);
  const registerPagesCollectionId = outputCollection.parentId!;

  const tbdRegisterPageEntries = _.differenceWith(
    // all register pages
    (() => {
      const registerPages = dc
        .getDocumentsByCollection(registerPagesCollectionId)
        .flatMap((document): RegisterPageEntry[] => {
          const completion = dc.getDocumentData(
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
    dc
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
            let document;
            try {
              document = dc.findDocumentByName(outputCollection.id, key);
            } catch {
              return;
            }
            return dc.getDocumentData(document.id);
          },
          async set(key, value) {
            dc.createDocument(outputCollection.id, key, value);
          },
        },
        maxInstrumentWorkers: args.maxInstrumentWorkers,
      });
      console.log(`end analysis ${registerPageKey} [${queueIndex}]`);
      dc.createDocument(outputCollection.id, registerPageKey, result);
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
  }
) {
  const { url: registerPageUrl } = registerPageEntry;

  return toCompletion(() =>
    useWorker(
      { maxWorkers: options.maxInstrumentWorkers },
      async (workerExec) => {
        const runIpf = async (
          chunkKeyPrefix: string,
          passwordList: string[],
          hint?: InputPasswordFieldHint
        ): Promise<InputPasswordFieldResult> => {
          const chunkKey = `${chunkKeyPrefix}:${registerPageEntry.key}`;
          const savedIpfResult = await options.chunkManager.get(chunkKey);
          if (savedIpfResult) {
            return savedIpfResult;
          }

          const computedIpfResult = await useBrowser(async (browser) => {
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
          });
          await options.chunkManager.set(chunkKey, computedIpfResult);
          return computedIpfResult;
        };

        const testIpfResult = await runIpf("test", [TEST_PASSWORD]);
        const ipfHint = mayDetectPSM(
          getIPFAbstractResultFromIPFResult(testIpfResult)
        );
        if (!ipfHint) {
          return <ChunkedPSMAnalysisResult>{
            testChunkExists: true,
          };
        }

        const detectIpfResult = await runIpf(
          "detect",
          [...getMonotoneTestPasswords(), TEST_PASSWORD],
          ipfHint
        );
        const psmDetected = detectPSM(
          getIPFAbstractResultFromIPFResult(detectIpfResult)
        );
        if (!psmDetected) {
          return <ChunkedPSMAnalysisResult>{
            testChunkExists: true,
            detectChunkExists: true,
          };
        }

        const enumeratedBuckets = buckets(
          getRockYou2021Passwords(),
          BUCKET_SIZE
        ).map((x, i): [typeof x, number] => [x, i]);

        let analysisIpfResult: InputPasswordFieldResult = [];
        for (const [bucket, i] of enumeratedBuckets) {
          const ipfResult = await runIpf(`analysis${i}`, bucket, ipfHint);
          analysisIpfResult = [...analysisIpfResult, ...ipfResult];
        }

        return <ChunkedPSMAnalysisResult>{
          testChunkExists: true,
          detectChunkExists: true,
          analysisChunkExists: true,
          analysisChunksCount: enumeratedBuckets.length,
        };
      }
    )
  );
}
