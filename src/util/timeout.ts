export function timeout(timeoutMs: number): Promise<void> {
  if (timeoutMs === Infinity) {
    return new Promise(() => {});
  }

  return new Promise((resolve) => setTimeout(resolve, timeoutMs));
}

export function bomb<T>(
  asyncCallback: () => Promise<T>,
  timeoutMs: number
): Promise<T> {
  return Promise.race([
    asyncCallback(),
    timeout(timeoutMs).then(() => {
      throw new TimeoutError(`Bomb exploded after ${timeoutMs} ms`);
    }),
  ]);
}

export class TimeoutError extends Error {
  constructor(message?: string) {
    super(message);
    this.name = TimeoutError.name;
  }
}
