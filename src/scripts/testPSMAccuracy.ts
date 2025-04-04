import zxcvbn from "zxcvbn";
import { getPSMAccuracy } from "../core/psm/PSMAccuracy";
import { readFileSync } from "fs";

function getZxcvbnScore(password: string) {
  return zxcvbn(password).score;
}

function getAppleScore(password: string) {
  const u = ((e, t) => {
    for (var n = [], r = 0; r < t.length; r++) n[r] = e.search(t[r]) > -1;
    return n;
  })(password, [
    /.{8,}/,
    /[0-9]/,
    /[A-Z]/,
    /[a-z]/,
    /[$&+,:;=?@#|'<>.^*()%!-]/,
  ]);

  const s = ((e, t, n) => {
    var r;
    return (
      0 === e.length
        ? (r = 0)
        : t < 3
        ? (r = 30)
        : t < 5 && t !== n
        ? (r = 60)
        : ((r = 90), t === n && e.length > 15 && (r = 100)),
      r
    );
  })(
    password,
    u.reduce((e, t) => e + (t ? 1 : 0), 0),
    u.length
  );

  return s;
}

function getSinaWeiboScore(password: string) {
  const b = (d: number) => {
    if (d >= 65 && d <= 90) {
      return 2;
    }
    if (d >= 97 && d <= 122) {
      return 4;
    } else {
      return 1;
    }
  };

  const a = (d: number) => {
    var e = 0;
    for (var i = 0; i < 3; i++) {
      if (d & 1) {
        e++;
      }
      d >>>= 1;
    }
    return e;
  };

  return ((e) => {
    var d = 0;
    for (var i = 0, len = e.length; i < len; i++) {
      d |= b(e.charCodeAt(i));
    }
    var f = a(d);
    if (e.length >= 10) {
      f++;
    }
    f = Math.min(Math.max(f, 1), 3);
    return f;
  })(password);
}

const filename = process.argv[2];

const content = readFileSync(filename).toString();

const passwordRows = content
  .split("\n")
  .filter((x) => x)
  .map((line) => line.split(" "))
  .map(([rawFrequency, password]): [string, number] => [
    password,
    parseInt(rawFrequency),
  ])
  .slice(1)
  .filter((_, i) => i % 10 === 0); // 0, 1, 2

console.log(
  JSON.stringify(
    Array.from(Array(100), (_, i) => i * 10).map((n) =>
      getPSMAccuracy(
        passwordRows.slice(0, n).map(([password, frequency], rankIndex) => ({
          frequency,
          referenceScore: rankIndex + 1,
          evaluatedScore: getZxcvbnScore(password),
        }))
      )
    )
  )
);
