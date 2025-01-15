import useTaskQueue, { Task } from "./taskQueue";
import { DomainModel } from "./DataAccessObject";

export default function processDomainTaskQueue(
  todoDomains: DomainModel[],
  taskQueueOptions: Parameters<typeof useTaskQueue>[0],
  taskFactory: (domainModel: DomainModel) => Task
): Promise<void> {
  return useTaskQueue(taskQueueOptions, async (taskQueue) => {
    taskQueue.push(todoDomains.map(taskFactory));
    await taskQueue.drain();
  });
}
