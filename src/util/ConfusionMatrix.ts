export default class ConfusionMatrix<T> {
  tp: T[] = [];
  fp: T[] = [];
  tn: T[] = [];
  fn: T[] = [];

  addValue(value: T, actual: boolean, expected: boolean): void {
    (actual
      ? expected
        ? this.tp
        : this.fp
      : expected
      ? this.fn
      : this.tn
    ).push(value);
  }

  get(): {
    tp: T[];
    fp: T[];
    tn: T[];
    fn: T[];
  } {
    return {
      tp: [...this.tp],
      fp: [...this.fp],
      tn: [...this.tn],
      fn: [...this.fn],
    };
  }
}
