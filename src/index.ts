import buildSetup from "./buildSetup";
import instrument from "./instrument";
import timeout from "./timeout";
import useWorker from "./worker";
import {
  chromium,
  Frame,
  Locator,
  Page
  } from "playwright";

async function detectPSM(page: Page) {
  await timeout(15000); // wait enough time for the frames to spawn

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

async function main() {
  const browser = await chromium.launch({
    channel: "chromium",
    headless: false,
  });
  try {
    const page = await browser.newPage();

    await useWorker(async (workerExec) => {
      await page.route(
        () => true,
        async (route, request) => {
          if (request.resourceType() === "script") {
            try {
              const response = await route.fetch();
              const body = await response.body();
              const instBody = await workerExec(instrument, [
                body.toString(),
                request.url(),
              ]);
              route.fulfill({ response, body: instBody });
            } catch (e) {
              route.abort("failed");
              console.error(e);
            }
            return;
          }

          route.continue();
        }
      );
      await page.exposeBinding("$$notify", (source, record) => {
        console.log(record);
      });
      await page.addInitScript({ content: (await buildSetup()).toString() });

      await page.goto("https://account.apple.com/account?appId=632");
      await detectPSM(page);

      await timeout(Infinity); // DEBUG: prevent exiting
    });
  } catch (e) {
    console.error(e);
  } finally {
    await browser.close();
  }
}

main();
