import { reDigit, reSpecial, reUpper } from "./regexps";
import { ROCKYOU2021_PASSWORD_ROWS } from "./rockyou2021";

export type DetailedPassword = {
  password: string;
  hasPattern: boolean;
  length: number;
  hasUpper: boolean;
  hasDigit: boolean;
  hasSpecial: boolean;
};

export const TEST_PASSWORD: string = "fd*KZ$?J9Q2Fg!cz";

/**
 * - First group exception: known patterns, increasing entropy and length, fixed complexity
 * - Neither dictionary words nor known patterns (guessability depends exclusively on entropy, bruteforce required)
 * - Increasing entropy and length in every group
 * - Increasing complexity
 */
export const PSM_DETECTION_DETAILED_PASSWORD_GROUPS = [
  [
    "a!1A",
    "aaa!1A",
    "aaaaa!1A",
    "aaaaaaa!1A",
    "aaaaaaaaa!1A",
    "aaaaaaaaaaaaa!1A",
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
    "vs1A",
    "vshb1A",
    "vshbnc1A",
    "vshbncqa1A",
    "vshbncqajp1A",
    "vshbncqajpzkew1A",
  ],
  [
    "v!1A",
    "vsh!1A",
    "vshbn!1A",
    "vshbncq!1A",
    "vshbncqaj!1A",
    "vshbncqajpzke!1A",
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

export function getPSMDetectionPasswords(): string[] {
  return PSM_DETECTION_DETAILED_PASSWORD_GROUPS.flatMap((group) =>
    group.map(({ password }) => password)
  );
}

export function getRockYou2021Passwords(): string[] {
  return ROCKYOU2021_PASSWORD_ROWS.map(([password]) => password);
}
