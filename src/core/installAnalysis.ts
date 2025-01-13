import buildSetup from "./buildSetup";
import instrument from "./instrument";
import { Page } from "playwright";
import { WorkerExec } from "./worker";

export default async function installAnalysis(
  page: Page,
  options?: {
    workerExec?: WorkerExec;
  }
) {
  options || (options = {});
  const { workerExec } = options;

  const doInstrument = async (code: string, sourceUrl: string) =>
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
        const instBody = await doInstrument(body.toString(), request.url());
        route.fulfill({ response, body: instBody });
      } catch (e) {
        route.abort("failed");
        console.error(e);
      }
    }
  );

  await page.addInitScript({ content: (await buildSetup()).toString() });
}
