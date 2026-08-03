export default function zigzag<T>(collection: T[]): T[] {
  return collection.map((_, i, a) =>
    i % 2 === 0 ? (i + 1 !== a.length ? a[i + 1] : a[i]) : a[i - 1]
  );
}
