export type PasswordList = PasswordListItem[];

// [password, length, upperLetters, numbers, symbols]
export type PasswordListItem = [string, number, number, number, number];

export default function generatePasswordList(): PasswordList {
  return [...generatePasswordListItems()];
}

const LENGTHS: number[] = [6, 8, 12, 16, 20];

export function* generatePasswordListItems() {
  for (const length of LENGTHS) {
    for (let upperLetters = 0; upperLetters <= 2; upperLetters += 2) {
      for (let numbers = 0; numbers <= 2; numbers += 2) {
        for (let symbols = 0; symbols <= 2; symbols += 2) {
          yield <PasswordListItem>[
            generatePassword(length, upperLetters, numbers, symbols),
            length,
            upperLetters,
            numbers,
            symbols,
          ];
        }
      }
    }
  }
}

export function generatePassword(
  length: number,
  upperLetters: number,
  numbers: number,
  symbols: number
) {
  const pwdArray = Array(length);

  const availableIndexes = Array.from(Array(length), (_, i) => i);
  const insertCharacter = (chr: string) => {
    const n = randomNat(availableIndexes.length);
    const index = availableIndexes[n];
    availableIndexes.splice(n, 1);
    pwdArray[index] = chr;
  };

  // uppercase letters
  for (let i = 0; i < upperLetters; ++i) {
    insertCharacter(randomUpperLetter());
  }

  // numbers
  for (let i = 0; i < numbers; ++i) {
    insertCharacter(randomNumber());
  }

  // symbols
  for (let i = 0; i < symbols; ++i) {
    insertCharacter(randomSymbol());
  }

  // lowercase letters (rest)
  while (availableIndexes.length > 0) {
    insertCharacter(randomLowerLetter());
  }

  return pwdArray.join("");
}

function randomNat(n: number) {
  return Math.floor(Math.random() * n);
}

function randomLowerLetter() {
  return String.fromCharCode("a".charCodeAt(0) + randomNat(26));
}

function randomUpperLetter() {
  return String.fromCharCode("A".charCodeAt(0) + randomNat(26));
}

function randomNumber() {
  return String(randomNat(10));
}

const SYMBOLS = "!\";#$%&'()*+,-./:;<=>?@[]^_`{|}~"; // imported from https://passwordsgenerator.net/

function randomSymbol() {
  return SYMBOLS[randomNat(SYMBOLS.length)];
}
