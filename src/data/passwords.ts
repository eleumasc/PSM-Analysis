export const SAMPLE_WEAK_PASSWORD: string = "12345aA!";
export const SAMPLE_STRONG_PASSWORD: string = "Hg%4cvUz2^#{<~[?!Ch@";

export const VARIATING_LENGTH_WITH_PATTERN_PASSWORDS = [
  "aaaA1!",
  "aaaaaA1!",
  "aaaaaaaaaA1!",
  "aaaaaaaaaaaaaA1!",
];

export const VARIATING_LENGTH_NO_PATTERN_PASSWORDS = [
  "yH43!5",
  "_Q$794Wm",
  "%j5KBXp484UF",
  "X2*9s1K$_!5gBA6k",
];

export const VARIATING_COMPLEXITY_PASSWORDS = [
  "gtyraejuifsqzbkm",
  "x?luim$_n@#!cfoj",
  "03b2c8p6lg1vuj5f",
  "!p&imv3nw7/e9$>b",
  "fCeObLoaurRDQYms",
  "tXGc%aNQ!*+iI?-u",
  "zOWGmDacFUEp53A4",
];

/**
 * - Random (neither dictionary words nor known patterns)
 * - Increasing entropy
 * - Increasing complexity
 *
 * Len8
 * - lowercase (37.6)
 * - + uppercase (45.6)
 * - + digit (47.63)
 * - + symbol (52.44)
 * Len12
 * - lowercase (56.4)
 * - + uppercase (68.4)
 * - + digit (71.45)
 * - + symbol (78.66)
 * Len16
 * - lowercase (75.2) [SKIP: entropy is lower than Len12 + symbol]
 * - + uppercase (91.2)
 * - + digit (95.27)
 * - + symbol (104.87)
 */
export const ORDERED_PASSWORDS = [
  "zxmeiuta",
  "pozgdynA",
  "dkcviqA1",
  "kjaudA1!",
  "xzkqjugolrdm",
  "yjhnfdluxmeA",
  "elnrbyidtaA1",
  "gibuazknxA1!",
  "swztdclgvmfkuoqA",
  "eoxahvqktbuyfmA1",
  "juanbxzdvhrlpA1!",
];
