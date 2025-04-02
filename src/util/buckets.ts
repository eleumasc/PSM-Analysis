export default function buckets<T>(collection: T[], size: number): T[][] {
  const result: T[][] = [];

  collection = [...collection];
  while (collection.length > 0) {
    result.push(collection.splice(0, size));
  }

  return result;
}
