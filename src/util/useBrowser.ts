import path from "path";
import pluginStealth from "puppeteer-extra-plugin-stealth";
import { BrowserContext } from "playwright";
import { chromium } from "playwright-extra";
import { rootDir } from "../env";

const ANTI_COOKIE_PATH = path.join(rootDir, "I-Dont-Care-About-Cookies");

let pluginsRegistered = false;

export default async function useBrowser<T>(
  options: { headless?: boolean },
  use: (browser: BrowserContext) => Promise<T>
): Promise<T> {
  if (!pluginsRegistered) {
    chromium.use(pluginStealth());
    pluginsRegistered = true;
  }

  const browser = await chromium.launchPersistentContext("", {
    channel: "chromium",
    headless: options.headless ?? true,
    args: [
      `--disable-extensions-except=${ANTI_COOKIE_PATH}`,
      `--load-extension=${ANTI_COOKIE_PATH}`, // load extension "I Don't Care About Cookies"
    ],
    locale: "en-GB", // request pages in English
  });
  try {
    return await use(browser);
  } finally {
    await browser.close();
  }
}
