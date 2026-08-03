export type Task<R> = {
  op: string;
  args: any[];
};

export function makeTaskFromFunction<A extends any[], R>(
  func: (...args: A) => R,
  [...args]: A
): Task<R> {
  return { op: func.name, args };
}

export function dispatcher(methods: Record<string, Function>) {
  return async function ({ op, args }: Task<unknown>) {
    const func = methods[op];
    if (!func) {
      throw new ReferenceError(`${op} is not defined`);
    }
    return Reflect.apply(func, undefined, args);
  };
}
