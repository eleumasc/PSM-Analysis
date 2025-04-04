export default function mayBeScore(value: any): value is number {
  return typeof value === "number";
}
