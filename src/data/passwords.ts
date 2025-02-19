export const SAMPLE_WEAK_PASSWORD: string = "12345aA!";
export const SAMPLE_STRONG_PASSWORD: string = "Hg%4cvUz2^#{<~[?!Ch@";

/**
 * - First slice exception: known patterns, increasing entropy and length, fixed complexity
 * - Neither dictionary words nor known patterns (guessability depends exclusively on entropy, bruteforce required)
 * - Increasing entropy and length in every slice
 * - Increasing complexity
 */
export const PASSWORDS = [
  "aA1!",
  "aaaA1!",
  "aaaaaA1!",
  "aaaaaaaA1!",
  "aaaaaaaaaA1!",
  "aaaaaaaaaaaaaA1!",

  "vshb",
  "vshbnc",
  "vshbncqa",
  "vshbncqajp",
  "vshbncqajpzk",
  "vshbncqajpzkewmd",

  "vshA",
  "vshbnA",
  "vshbncqA",
  "vshbncqajA",
  "vshbncqajpzA",
  "vshbncqajpzkewmA",

  "vsA1",
  "vshbA1",
  "vshbncA1",
  "vshbncqaA1",
  "vshbncqajpA1",
  "vshbncqajpzkewA1",

  "vA1!",
  "vshA1!",
  "vshbnA1!",
  "vshbncqA1!",
  "vshbncqajA1!",
  "vshbncqajpzkeA1!",
];
