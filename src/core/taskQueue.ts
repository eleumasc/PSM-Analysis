import * as async from "async";

export type Task = () => Promise<void>;

export type TaskQueue = async.QueueObject<Task>;

export default async function useTaskQueue<T>(
  options:
    | {
        maxTasks?: number;
      }
    | undefined,
  use: (taskQueue: TaskQueue) => Promise<T>
): Promise<T> {
  const taskQueue = async.queue<Task, unknown>(async (task, callback) => {
    try {
      await task();
      callback();
    } catch (error) {
      callback(error);
    }
  }, options?.maxTasks ?? 1);
  try {
    return await use(taskQueue);
  } finally {
    taskQueue.kill();
  }
}
