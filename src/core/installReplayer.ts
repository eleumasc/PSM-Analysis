import { Page } from "playwright";
import path from "path";
import { rootDir } from "../env";
import {
  createResponseOverrideMapCached,
  ResponseOverrideMap,
} from "./ResponseOverride";
import assert from "assert";
import { toArray } from "iter-tools";

export default async function installReplayer(
  page: Page,
  replayHarPath: string,
  options: {
    analysisMode?: boolean;
    routeFromHar?: boolean;
  },
) {
  let responseOverrideMap: ResponseOverrideMap | undefined;
  if (options.analysisMode) {
    responseOverrideMap = await createResponseOverrideMapCached(replayHarPath);
  }

  if (options.analysisMode) {
    assert(responseOverrideMap);
    await page.route(
      () => true,
      async (route, request) => {
        const url = request.url();
        const responseOverride = responseOverrideMap.get(url);
        if (responseOverride) {
          return route.fulfill(responseOverride);
        } else if (options.routeFromHar) {
          return route.abort();
        } else {
          return route.fallback();
        }
      },
    );

    await page.addInitScript({ path: path.join(rootDir, "setup.js") });
  }

  if (options.routeFromHar) {
    let urlRegexp: RegExp | undefined;
    if (options.analysisMode) {
      assert(responseOverrideMap);
      const alternatives = toArray(responseOverrideMap.keys())
        .map((s) => s.replace(/[^A-Za-z0-9]/g, "\\$&"))
        .join("|");
      urlRegexp = new RegExp(`^(?!^(?:${alternatives})\$).*\$`);
    }

    await page.routeFromHAR(replayHarPath, {
      notFound: "abort",
      url: urlRegexp,
    });
  }
}
