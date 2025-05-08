// Seeded random function using a linear congruential generator (LCG)
export default function createSeededRandom(seed: number): () => number {
  const m = 0x80000000;
  const a = 1103515245;
  const c = 12345;

  let state = seed;

  return function () {
    state = (a * state + c) % m;
    return state / m;
  };
}
