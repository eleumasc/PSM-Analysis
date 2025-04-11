import zxcvbn from "zxcvbn";
import { getRockYou2021Passwords } from "../data/passwords";

console.log(
  JSON.stringify(
    [...getRockYou2021Passwords()].map((password) => zxcvbn(password).guesses)
  )
);
