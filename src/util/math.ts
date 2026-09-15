import _ from "lodash";

export function avg(xs: number[]): number {
  return _.mean(xs);
}

export function stddev(xs: number[]): number {
  return Math.sqrt(avg(xs.map((x) => x ** 2)) - avg(xs) ** 2);
}
