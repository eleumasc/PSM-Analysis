import { reDigit, reSpecial, reUpper } from "./regexps";

export type DetailedPassword = {
  password: string;
  hasPattern: boolean;
  length: number;
  hasUpper: boolean;
  hasDigit: boolean;
  hasSpecial: boolean;
};

export const SAMPLE_WEAK_PASSWORD: string = "12345aA!";
export const SAMPLE_STRONG_PASSWORD: string = "Hg%4cvUz2^#{<~[?!Ch@";

/**
 * - First group exception: known patterns, increasing entropy and length, fixed complexity
 * - Neither dictionary words nor known patterns (guessability depends exclusively on entropy, bruteforce required)
 * - Increasing entropy and length in every group
 * - Increasing complexity
 */
export const SELECTED_DETAILED_PASSWORD_GROUPS = [
  [
    "aA1!",
    "aaaA1!",
    "aaaaaA1!",
    "aaaaaaaA1!",
    "aaaaaaaaaA1!",
    "aaaaaaaaaaaaaA1!",
  ],
  [
    "vshb",
    "vshbnc",
    "vshbncqa",
    "vshbncqajp",
    "vshbncqajpzk",
    "vshbncqajpzkewmd",
  ],
  [
    "vshA",
    "vshbnA",
    "vshbncqA",
    "vshbncqajA",
    "vshbncqajpzA",
    "vshbncqajpzkewmA",
  ],
  [
    "vsA1",
    "vshbA1",
    "vshbncA1",
    "vshbncqaA1",
    "vshbncqajpA1",
    "vshbncqajpzkewA1",
  ],
  [
    "vA1!",
    "vshA1!",
    "vshbnA1!",
    "vshbncqA1!",
    "vshbncqajA1!",
    "vshbncqajpzkeA1!",
  ],
].map((group, groupIndex) =>
  group.map(
    (password): DetailedPassword => ({
      password,
      hasPattern: groupIndex === 0,
      length: password.length,
      hasUpper: reUpper().test(password),
      hasDigit: reDigit().test(password),
      hasSpecial: reSpecial().test(password),
    })
  )
);

export function getSelectedPasswords(): string[] {
  return SELECTED_DETAILED_PASSWORD_GROUPS.flatMap((group) =>
    group.map(({ password }) => password)
  );
}

export { ROCKYOU2021_PASSWORDS } from "./rockyou2021";
