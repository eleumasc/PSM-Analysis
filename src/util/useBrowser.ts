import pluginStealth from "puppeteer-extra-plugin-stealth";
import { BrowserContext } from "playwright";
import { chromium } from "playwright-extra";
import { idcacDir } from "../idcacDir";

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
    headless: options.headless ?? true,
    args: [
      `--disable-extensions-except=${idcacDir}`,
      `--load-extension=${idcacDir}`, // load extension "I Don't Care About Cookies"
    ],
    locale: "en-GB", // request pages in English
  });
  try {
    return await use(browser);
  } finally {
    await browser.close();
  }
}
