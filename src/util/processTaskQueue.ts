import useTaskQueue, { Task } from "./TaskQueue";

export default function processTaskQueue<T>(
  inputs: T[],
  taskQueueOptions: Parameters<typeof useTaskQueue>[0],
  taskFactory: (input: T, queueIndex: number) => Task
): Promise<void> {
  return useTaskQueue(taskQueueOptions, async (taskQueue) => {
    taskQueue.push(inputs.map(taskFactory));
    await taskQueue.drain();
  });
}
