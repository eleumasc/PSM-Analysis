import path from "path";
import timeout from "./timeout";
import { chromium, Page } from "playwright";
import { rootDir } from "./rootDir";

async function findAndFillPasswordField(page: Page) {
  await timeout(10000); // wait enough time for the frames to spawn
  await Promise.allSettled(
    page.frames().map((frame) =>
      frame
        .locator('input[type="password"]')
        .first()
        .pressSequentially("123456", {
          delay: 100,
          timeout: 10000,
        })
    )
  );
}

async function main() {
  const browser = await chromium.launch({
    headless: false,
  });
  try {
    const page = await browser.newPage();
    await page.addInitScript({ path: path.join(rootDir, "setup.js") });

    // await page.goto("https://account.apple.com/account?appId=632");
    // await findAndFillPasswordField(page);

    await timeout(Infinity); // DEBUG: prevent exiting
  } catch (e) {
    console.error(e);
  } finally {
    await browser.close();
  }
}

main();
