import instrument from "./instrument";
import Pool from "workerpool/types/Pool";
import workerpool, { isMainThread } from "workerpool";
import { DEV } from "../util/dev";
import { runProbePSM } from "../commands/cmdProbePSM";
import { runSearchSignupPage } from "../commands/cmdSearchSignupPage";

export default async function useWorker<T>(
  options:
    | {
        maxWorkers?: number;
        maxWorkerMemory?: number;
      }
    | undefined,
  use: (workerExec: WorkerExec) => Promise<T>
): Promise<T> {
  const pool = workerpool.pool(__filename, {
    maxWorkers: options?.maxWorkers,
    workerThreadOpts: {
      execArgv: DEV ? ["--require", "ts-node/register"] : undefined,
      resourceLimits: {
        maxOldGenerationSizeMb: options?.maxWorkerMemory,
      },
    },
  });
  try {
    return await use(createWorkerExec(pool));
  } finally {
    await pool.terminate();
  }
}

export type WorkerExec = ReturnType<typeof createWorkerExec>;

function createWorkerExec(pool: Pool) {
  return async function workerExec<A extends any[], R>(
    method: (...args: A) => R,
    [...args]: A
  ): Promise<Awaited<R>> {
    return await pool.exec(method.name, args);
  };
}

if (!isMainThread) {
  workerpool.worker({
    instrument,
    runSearchSignupPage,
    runProbePSM,
  });
}
