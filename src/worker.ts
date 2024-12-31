import instrument from "./instrument";
import Pool from "workerpool/types/Pool";
import workerpool, { isMainThread } from "workerpool";
import { DEV } from "./dev";

export default async function useWorker<T>(
  use: (workerExec: WorkerExec) => Promise<T>
): Promise<T> {
  const pool = workerpool.pool(__filename, {
    workerThreadOpts: {
      execArgv: DEV ? ["--require", "ts-node/register"] : undefined,
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
  });
}
