import pluginStealth from "puppeteer-extra-plugin-stealth";
import searchSignupPage from "./searchSignupPage";
import useWorker from "./worker";
import { chromium } from "playwright-extra";
import { idcacDir } from "./idcacDir";

async function main() {
  chromium.use(pluginStealth());
  const browser = await chromium.launchPersistentContext("", {
    headless: false,
    args: [
      `--disable-extensions-except=${idcacDir}`,
      `--load-extension=${idcacDir}`, // load extension "I Don't Care About Cookies"
    ],
    locale: "en-GB", // request pages in English
  });
  try {
    const page = await browser.newPage();

    await useWorker(async (workerExec) => {
      // await installAnalysis(page, { workerExec });

      // await page.goto("https://account.apple.com/account?appId=632");
      // await timeout(10000); // wait enough time for the frames to spawn
      // await findAndFillPasswordField(page);

      console.log(await searchSignupPage(page, "ebay.com"));

      // await timeout(Infinity); // DEBUG: prevent exiting
    });
  } catch (e) {
    console.error(e);
  } finally {
    await browser.close();
  }
}

main();
