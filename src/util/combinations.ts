export default function* combinations<T>(elements: T[]): Generator<T[]> {
  if (elements.length === 0) {
    yield [];
    return;
  }
  const [head, ...tail] = elements;
  for (const tailComb of combinations(tail)) {
    yield tailComb;
    yield [head, ...tailComb];
  }
}
