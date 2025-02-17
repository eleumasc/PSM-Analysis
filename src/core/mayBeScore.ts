export default function mayBeScore(value: any): boolean {
  return typeof value === "number" && value % 1 === 0;
}
