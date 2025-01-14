export function randomIdentifier(): string {
  let r = "";
  for (let i = 0; i < 8; ++i) {
    const n = Math.floor(Math.random() * 52);
    if (n < 26) {
      r += String.fromCharCode("A".charCodeAt(0) + n);
    } else {
      r += String.fromCharCode("a".charCodeAt(0) + n - 26);
    }
  }
  return r;
}

export function uniqueIdentifier(s: string): string {
  let r;
  while (s.includes((r = randomIdentifier()))) {}
  return r;
}
