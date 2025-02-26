function weightedRank(
  x: number[],
  w: number[] = Array(x.length).fill(1)
): number[] {
  const n = x.length;
  const indices = x.map((_, i) => i).sort((a, b) => x[a] - x[b]);
  const rord = indices.map((_, i) => i).sort((a, b) => indices[a] - indices[b]);
  const xp = indices.map((i) => x[i]);
  const wp = indices.map((i) => w[i]);
  const rnk = Array(n).fill(NaN);

  let t1 = 0;
  let i = 0;
  let t2 = 0;
  let tiedCount = 0;

  while (i < n - 1) {
    t2 += wp[i];
    tiedCount++;

    if (xp[i + 1] !== xp[i]) {
      const rankValue = t1 + (1 + (t2 - 1) / 2);
      for (let j = 0; j < tiedCount; j++) {
        rnk[i - j] = rankValue;
      }
      t1 += t2;
      t2 = 0;
      tiedCount = 0;
    }
    i++;
  }

  t2 += wp[i];
  const finalRank = t1 + (1 + (t2 - 1) / 2);
  for (let j = 0; j < tiedCount + 1; j++) {
    rnk[i - j] = finalRank;
  }

  return rord.map((i) => rnk[i]);
}
export function weightedSpearman(x: number[], y: number[], w: number[]): number {
  const xr = weightedRank(x, w);
  const yr = weightedRank(y, w);
  const totalWeight = w.reduce((sum, wi) => sum + wi, 0);
  const xb = w.reduce((sum, wi, i) => sum + wi * xr[i], 0) / totalWeight;
  const yb = w.reduce((sum, wi, i) => sum + wi * yr[i], 0) / totalWeight;

  const numerator = w.reduce(
    (sum, wi, i) => sum + wi * (xr[i] - xb) * (yr[i] - yb),
    0
  );
  const denominator = Math.sqrt(
    w.reduce((sum, wi, i) => sum + wi * (xr[i] - xb) ** 2, 0) *
    w.reduce((sum, wi, i) => sum + wi * (yr[i] - yb) ** 2, 0)
  );

  return numerator / denominator;
}
