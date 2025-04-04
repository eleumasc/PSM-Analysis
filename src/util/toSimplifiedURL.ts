export default function toSimplifiedURL(url: string | URL): URL {
  const cookedUrl = new URL(url);
  cookedUrl.search = "";
  cookedUrl.hash = "";
  return cookedUrl;
}
