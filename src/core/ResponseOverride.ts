import { existsSync, readFileSync, writeFileSync } from "fs";
import { Har } from "../util/Har";
import instrument from "./instrument";
import path from "path";

type ResponseOverrideMap = Map<string, ResponseOverride>;

type ResponseOverrideMapEntry = [string, ResponseOverride];

type ResponseOverride = {
  status: number;
  headers: { [key: string]: string };
  body: string;
};

export const INSTRUMENT_MAX_LENGTH: number = 8 * 1024 * 1024; // 8MB

export async function createResponseOverrideMap(
  harPath: string,
): Promise<ResponseOverrideMap> {
  const har = new Har(harPath);
  const mapEntryPromises = await Promise.allSettled(
    har
      .entries()
      .filter(
        ({ request: { url: requestUrl }, response: { content } }) =>
          /^https?\:/.test(requestUrl) &&
          content.size !== -1 &&
          content.mimeType.includes("javascript"),
      )
      .map(
        ({
          request: { url: requestUrl },
          response: { status, headers, content },
        }): ResponseOverrideMapEntry => [
          requestUrl,
          {
            status,
            headers: Object.fromEntries(headers.map((h) => [h.name, h.value])),
            body: har.readContent(content),
          },
        ],
      )
      .filter(([requestUrl, { body }]) => {
        const r = body.length < INSTRUMENT_MAX_LENGTH;
        if (!r) {
          console.error(
            `[${requestUrl}] The script was not instrumented due to its excessive length: ${body.length}`,
          );
        }
        return r;
      })
      .map(async ([requestUrl, entry]): Promise<ResponseOverrideMapEntry> => {
        try {
          const { body } = entry;
          const overrideBody = await instrument(body, requestUrl);
          return [requestUrl, { ...entry, body: overrideBody }];
        } catch (e) {
          console.error(`[${requestUrl}] Failed to instrument script: ${e}`);
          throw e;
        }
      }),
  );
  const mapEntries = mapEntryPromises
    .filter((x) => x.status === "fulfilled")
    .map((x) => x.value);
  return new Map(mapEntries);
}

export async function createResponseOverrideMapCached(
  harPath: string,
): Promise<ResponseOverrideMap> {
  const cachedPath = path.join(
    path.dirname(harPath),
    path.basename(harPath, ".har.zip") + ".override.json",
  );
  if (existsSync(cachedPath)) {
    const mapEntries = JSON.parse(
      readFileSync(cachedPath).toString(),
    ) as ResponseOverrideMapEntry[];
    return new Map(mapEntries);
  } else {
    const map = await createResponseOverrideMap(harPath);
    writeFileSync(cachedPath, JSON.stringify([...map.entries()]));
    return map;
  }
}
