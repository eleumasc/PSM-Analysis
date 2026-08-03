import { createHash } from "crypto";

export default function encodeAsFilename(s: string): string {
  return s.replace(/[^A-Za-z0-9-_]/g, "+");
}

export function encodeUrlAsFilenameHash(url: string | URL): string {
  url = new URL(url);
  const { origin } = url;
  const hash = createHash("md5").update(url.toString()).digest("hex");
  return `${encodeAsFilename(origin)}+${hash}`;
}
