import path from "path";
import pluginStealth from "puppeteer-extra-plugin-stealth";
import { Page } from "playwright";
import { chromium } from "playwright-extra";
import { rootDir } from "../env";

const ANTI_COOKIE_PATH = path.join(rootDir, "I-Dont-Care-About-Cookies");

let pluginsRegistered = false;

export default async function useBrowser<T>(
  options: {
    headless?: boolean;
    recordHarPath?: string;
  },
  use: (page: Page) => Promise<T>
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
    recordHar: options.recordHarPath
      ? {
          path: options.recordHarPath,
          content: "attach",
        }
      : undefined,
  });
  const page = await browser.newPage();
  try {
    return await use(page);
  } finally {
    await browser.close();
  }
}
