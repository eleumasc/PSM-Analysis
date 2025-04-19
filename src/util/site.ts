import psl from "psl";

export function isSameSite(thisDomain: URL, thatDomain: URL): boolean {
  return (
    getSiteByDomain(thisDomain.hostname) ===
    getSiteByDomain(thatDomain.hostname)
  );
}

export function getSiteByDomain(domain: string): string {
  const site = psl.get(domain);
  return site ?? domain;
}
