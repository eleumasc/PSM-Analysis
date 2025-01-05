export default function timeout(timeoutMs: number) {
  if (timeoutMs === Infinity) {
    return new Promise(() => {});
  }

  return new Promise((resolve) => setTimeout(resolve, timeoutMs));
}
