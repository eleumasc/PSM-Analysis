import installAnalysis from "./installAnalysis";
import timeout from "./timeout";
import useWorker from "./worker";
import { chromium } from "playwright";
import { findAndFillPasswordField } from "./findAndFillPasswordField";

async function main() {
  const browser = await chromium.launch({
    channel: "chromium",
    headless: false,
  });
  try {
    const page = await browser.newPage();

    await useWorker(async (workerExec) => {
      await installAnalysis(page, { workerExec });

      await page.goto("https://account.apple.com/account?appId=632");
      await timeout(10000); // wait enough time for the frames to spawn
      await findAndFillPasswordField(page);

      await timeout(Infinity); // DEBUG: prevent exiting
    });
  } catch (e) {
    console.error(e);
  } finally {
    await browser.close();
  }
}

main();
