const DEFAULT_COMPARE_FN = <T>(t: T, u: T): number =>
  t <= u ? (t < u ? -1 : 0) : 1;

export function isAscending<T>(
  elements: T[],
  compareFn?: (t: T, u: T) => number
): boolean {
  compareFn || (compareFn = DEFAULT_COMPARE_FN);
  return elements.every((e, i, a) => i === 0 || compareFn(a[i - 1], e) <= 0);
}

export function isDescending<T>(
  elements: T[],
  compareFn?: (t: T, u: T) => number
): boolean {
  compareFn || (compareFn = DEFAULT_COMPARE_FN);
  return elements.every((e, i, a) => i === 0 || compareFn(a[i - 1], e) >= 0);
}

export function isConstant<T>(
  elements: T[],
  compareFn?: (t: T, u: T) => number
): boolean {
  compareFn || (compareFn = DEFAULT_COMPARE_FN);
  return elements.every((e, i, a) => i === 0 || compareFn(a[0], e) === 0);
}
