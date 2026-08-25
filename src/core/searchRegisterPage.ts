import findRegisterForm from "./findRegisterForm";
import getFormStructures, { FormStructure } from "./getFormStructures";
import { Page } from "playwright";
import { timeout } from "../util/timeout";

const REGISTER_REGEXP: RegExp =
  /sign([^0-9a-zA-Z]|\s)*up|regist(er|ration)?|join|(create|new)([^0-9a-zA-Z]|\s)*(new([^0-9a-zA-Z]|\s)*)?(acc(ount)?|us(e)?r|prof(ile)?)/i;

const LOGIN_REGEXP: RegExp =
  /(log|sign)([^0-9a-zA-Z]|\s)*(in|on)|authenticat(e|ion)|\/(my([^0-9a-zA-Z]|\s)*)?(user|account|profile|dashboard)/i;

const NAVIGATE_EXTRA_TIMEOUT_MS: number = 5000;

const MAX_CANDIDATE_URLS_PER_PAGE: number = 4;

type CandidateType = "register" | "login";

type Candidate = {
  url: string;
  type: CandidateType;
};

type LogRecord = {
  type: string;
} & (
  | {
      type: "init-step";
      step: number;
    }
  | {
      type: "navigate";
      url: string;
      targetUrl: string;
      formStructures: FormStructure[];
    }
  | {
      type: "navigate-error";
      url: string;
      reason: string;
    }
  | {
      type: "crawl";
      candidates: Candidate[];
    }
);

export type SearchRegisterPageResult = {
  rpUrl: string | null;
  logRecords: LogRecord[];
};

// Register-page search à la Alroomi and Li.
export default async function searchRegisterPage(
  page: Page,
  site: string
): Promise<SearchRegisterPageResult> {
  const logRecords: LogRecord[] = [];

  const siteUrl = new URL(site.includes("://") ? site : `http://${site}/`);

  const siteHostname = siteUrl.hostname.replace(/^www\./i, "").toLowerCase();

  function createResult(rpUrl: string | null): SearchRegisterPageResult {
    return {
      rpUrl,
      logRecords,
    };
  }

  function isOnTargetDomain(url: string): boolean {
    try {
      const hostname = new URL(url).hostname
        .replace(/^www\./i, "")
        .toLowerCase();

      return hostname === siteHostname || hostname.endsWith(`.${siteHostname}`);
    } catch {
      return false;
    }
  }

  /**
   * Return the part of the URL on which candidate-keyword matching should
   * operate.
   *
   * We intentionally exclude the hostname, since a domain name containing
   * e.g. "login" or "register" should not make every URL on that domain a
   * candidate.
   */
  function getUrlCandidateText(url: string): string {
    try {
      const parsed = new URL(url);
      const text = `${parsed.pathname}${parsed.search}${parsed.hash}`;

      try {
        return decodeURIComponent(text);
      } catch {
        return text;
      }
    } catch {
      return url;
    }
  }

  /**
   * Classify a URL as a register or login candidate.
   *
   * If a URL matches both, prefer "register", since register pages are the
   * pages we ultimately want to discover.
   */
  function classifyUrl(url: string): CandidateType | null {
    const text = getUrlCandidateText(url);

    if (REGISTER_REGEXP.test(text)) {
      return "register";
    }

    if (LOGIN_REGEXP.test(text)) {
      return "login";
    }

    return null;
  }

  /**
   * Convert a list of URLs to candidates.
   *
   * Only URLs on the target domain are retained. Duplicate URLs are removed.
   */
  function makeCandidates(
    urls: string[],
    allowedTypes: ReadonlySet<CandidateType>
  ): Candidate[] {
    const candidates: Candidate[] = [];
    const seen = new Set<string>();

    for (const url of urls) {
      if (!isOnTargetDomain(url)) {
        continue;
      }

      const type = classifyUrl(url);

      if (type === null || !allowedTypes.has(type)) {
        continue;
      }

      if (seen.has(url)) {
        continue;
      }

      seen.add(url);

      candidates.push({
        url,
        type,
      });
    }

    return candidates;
  }

  async function navigate(url: string) {
    try {
      await page.goto(url);
      await timeout(NAVIGATE_EXTRA_TIMEOUT_MS);

      const targetUrl = page.url();
      const formStructures = await getFormStructures(page);

      logRecords.push({
        type: "navigate",
        url,
        targetUrl,
        formStructures,
      });

      return {
        targetUrl,
        formStructures,
      };
    } catch (e) {
      logRecords.push({
        type: "navigate-error",
        url,
        reason: e instanceof Error ? (e.stack ?? e.message) : String(e),
      });

      throw e;
    }
  }

  /**
   * Collect candidate links from the currently loaded page.
   *
   * Candidate detection operates on the link URL (href), not on the visible
   * anchor text.
   */
  async function collectCandidates(
    allowedTypes: ReadonlySet<CandidateType>
  ): Promise<Candidate[]> {
    const urls = await page
      .locator("a[href]")
      .evaluateAll((anchors) =>
        anchors.map((a) => (a as HTMLAnchorElement).href)
      );

    return makeCandidates(urls, allowedTypes);
  }

  /**
   * Visit register candidates found on a login page.
   *
   * This deliberately does not recurse further: once a login page is reached,
   * we collect further register candidates while ignoring further login
   * candidates.
   */
  async function crawlRegisterCandidates(
    candidates: Candidate[]
  ): Promise<string | null> {
    const candidatesToVisit = candidates.slice(0, MAX_CANDIDATE_URLS_PER_PAGE);

    logRecords.push({
      type: "crawl",
      candidates: candidatesToVisit,
    });

    for (const candidate of candidatesToVisit) {
      try {
        const { targetUrl, formStructures } = await navigate(candidate.url);

        if (findRegisterForm(formStructures)) {
          return targetUrl;
        }
      } catch {
        // Ignore inaccessible candidates and continue.
      }
    }

    return null;
  }

  /**
   * Visit register/login candidates originating from either:
   *
   *   - the landing page; or
   *   - the search-engine results.
   *
   * Every candidate is first checked directly for a register form.
   *
   * If the candidate is a login URL and no register form is found directly,
   * collect register candidates from that page and visit up to four of them.
   */
  async function crawl(candidates: Candidate[]): Promise<string | null> {
    const candidatesToVisit = candidates.slice(0, MAX_CANDIDATE_URLS_PER_PAGE);

    logRecords.push({
      type: "crawl",
      candidates: candidatesToVisit,
    });

    for (const candidate of candidatesToVisit) {
      try {
        const { targetUrl, formStructures } = await navigate(candidate.url);

        if (findRegisterForm(formStructures)) {
          return targetUrl;
        }

        if (candidate.type === "login") {
          const registerCandidates = await collectCandidates(
            new Set<CandidateType>(["register"])
          );

          const rpUrl = await crawlRegisterCandidates(registerCandidates);

          if (rpUrl !== null) {
            return rpUrl;
          }
        }
      } catch {
        // Ignore inaccessible candidates and continue.
      }
    }

    return null;
  }

  /**
   * DuckDuckGo can expose search-result links through an intermediary URL
   * containing the real destination in the "uddg" query parameter.
   */
  function unwrapDuckDuckGoUrl(url: string): string {
    try {
      const parsed = new URL(url);

      if (
        parsed.hostname === "duckduckgo.com" ||
        parsed.hostname.endsWith(".duckduckgo.com")
      ) {
        const targetUrl = parsed.searchParams.get("uddg");

        if (targetUrl !== null) {
          return targetUrl;
        }
      }
    } catch {
      // Keep the original URL.
    }

    return url;
  }

  // -------------------------------------------------------------------------
  // (1) Search for a register form on the domain's landing page.
  // -------------------------------------------------------------------------
  {
    logRecords.push({
      type: "init-step",
      step: 1,
    });

    const { targetUrl: landingPageUrl, formStructures } = await navigate(
      siteUrl.toString()
    );

    if (findRegisterForm(formStructures)) {
      return createResult(landingPageUrl);
    }
  }

  // -------------------------------------------------------------------------
  // (2) Crawl register/login candidates found on the landing page.
  // -------------------------------------------------------------------------
  {
    logRecords.push({
      type: "init-step",
      step: 2,
    });

    const candidates = await collectCandidates(
      new Set<CandidateType>(["register", "login"])
    );

    const rpUrl = await crawl(candidates);

    if (rpUrl !== null) {
      return createResult(rpUrl);
    }
  }

  // -------------------------------------------------------------------------
  // (3) Query DuckDuckGo for the domain's account register pages, then apply
  //     the same register/login candidate procedure to the results.
  // -------------------------------------------------------------------------
  {
    logRecords.push({
      type: "init-step",
      step: 3,
    });

    const query = `${siteHostname} account register signup create`;

    await page.goto(`https://duckduckgo.com/?q=${encodeURIComponent(query)}`);

    await timeout(NAVIGATE_EXTRA_TIMEOUT_MS);

    const resultUrls = (
      await page
        .locator("article h2 a[href]")
        .evaluateAll((anchors) =>
          anchors.map((a) => (a as HTMLAnchorElement).href)
        )
    ).map(unwrapDuckDuckGoUrl);

    const candidates = makeCandidates(
      resultUrls,
      new Set<CandidateType>(["register", "login"])
    );

    const rpUrl = await crawl(candidates);

    if (rpUrl !== null) {
      return createResult(rpUrl);
    }
  }

  return createResult(null);
}
