import { Frame, Locator, Page } from "playwright";

export default async function findAndFillPasswordField(page: Page) {
  const framePwdFieldPairs = (
    await Promise.allSettled(
      page
        .frames()
        .map((frame): [Frame, Locator] => [
          frame,
          frame.locator('input[type="password"]').first(),
        ])
        .map(async (pair) => {
          const [_, pwdField] = pair;
          return (await pwdField.count()) > 0 ? pair : null;
        })
    )
  )
    .filter((result) => result.status === "fulfilled")
    .map(({ value }) => value)
    .filter((value): value is NonNullable<typeof value> => Boolean(value));

  if (framePwdFieldPairs.length !== 1) {
    if (framePwdFieldPairs.length === 0) {
      console.log("No password field found -- skipping");
    } else if (framePwdFieldPairs.length > 1) {
      console.log("More than one password field found -- skipping");
    }
    return;
  }

  const [frame, pwdField] = framePwdFieldPairs[0];
  console.log("pwdField", frame.url());
  await pwdField.fill("Hg%4cvUz2^#{<~[?!Ch@"); // strong password
}
