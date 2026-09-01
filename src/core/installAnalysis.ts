import { Page } from "playwright";
import path from "path";
import { rootDir } from "../env";
import { createResponseOverrideMapCached } from "./ResponseOverride";

export default async function installAnalysis(
  page: Page,
  replayHarPath: string,
) {
  const responseOverrideMap =
    await createResponseOverrideMapCached(replayHarPath);

  await page.route(
    () => true,
    async (route, request) => {
      const url = request.url();

      const responseOverride = responseOverrideMap.get(url);
      if (responseOverride) {
        return route.fulfill(responseOverride);
      } else {
        return route.continue();
      }
    },
  );

  await page.addInitScript({ path: path.join(rootDir, "setup.js") });
}
