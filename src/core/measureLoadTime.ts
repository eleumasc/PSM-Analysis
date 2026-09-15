import assert from "assert";
import locatePasswordField from "./locatePasswordField";
import { Page } from "playwright";

export type MeasureLoadTimeResult = {
  loadTime: number;
};

export default async function measureLoadTime(
  page: Page,
  options: {
    rpUrl: string;
  },
): Promise<MeasureLoadTimeResult> {
  const { rpUrl } = options;

  let loadTime: number | undefined;
  await page.exposeBinding("__measureLoadTime", async (source, args) => {
    if (source.frame !== page.mainFrame()) return;
    const { loadTime: pageLoadTime } = args;
    assert(typeof pageLoadTime === "number");
    loadTime = pageLoadTime;
  });
  await page.addInitScript(`
    window.addEventListener("load", () => {
      const loadTime = performance.mark("pageEnd").startTime;
      window.__measureLoadTime({ loadTime });
    });
  `);

  await locatePasswordField(page, { rpUrl });

  assert(loadTime !== undefined);
  return { loadTime };
}
