import buildSetup from "./buildSetup";
import instrument from "./instrument";
import { Page } from "playwright";
import { WorkerExec } from "./worker";

const INSTRUMENT_MAX_LENGTH: number = 4 * 1024 * 1024;

export default async function installAnalysis(
  page: Page,
  options?: {
    workerExec?: WorkerExec;
  }
) {
  options || (options = {});
  const { workerExec } = options;

  const callInstrument = async (code: string, sourceUrl: string) =>
    workerExec
      ? await workerExec(instrument, [code, sourceUrl])
      : await instrument(code, sourceUrl);

  await page.route(
    () => true,
    async (route, request) => {
      if (request.resourceType() !== "script") {
        route.continue();
        return;
      }
      try {
        const response = await route.fetch();
        const body = await response.body();
        if (body.length >= INSTRUMENT_MAX_LENGTH) {
          route.fulfill({ response, body });
          console.error(
            `[ANALYSIS] The script was not instrumented due to its excessive length: ${request.url()}`
          );
          return;
        }
        const instrumentedBody = await callInstrument(
          body.toString(),
          request.url()
        );
        route.fulfill({ response, body: instrumentedBody });
      } catch (e) {
        route.abort("failed");
        console.error(e);
      }
    }
  );

  await page.addInitScript({ content: (await buildSetup()).toString() });
}
