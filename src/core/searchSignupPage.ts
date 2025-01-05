import detectSignupPage from "./detectSignupPage";
import getFormStructures, { FormStructure } from "./getFormStructures";
import timeout from "../util/timeout";
import { Page } from "playwright";

const SIGNUP_REGEXP: RegExp = /sign\s?up|register|create|join/i;

const LOGIN_REGEXP: RegExp = /log\s?[io]n|sign\s?[io]n/i;

const NAVIGATION_EXTRA_TIMEOUT_MS: number = 5000;

const MAX_CANDIDATE_URLS_PER_PAGE: number = 4;

type CandidateEntry = {
  url: string;
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
      reason: string;
    }
  | {
      type: "crawl";
      candidateEntries: CandidateEntry[];
    }
);

export type SearchSignupPageResult = {
  signupPageUrl: string | null;
  logRecords: LogRecord[];
};

// signup page search à la Alroomi et Li
export default async function searchSignupPage(
  page: Page,
  domain: string
): Promise<SearchSignupPageResult> {
  const logRecords: LogRecord[] = [];

  function createResult(signupPageUrl: string | null): SearchSignupPageResult {
    return { signupPageUrl, logRecords };
  }

  async function navigate(url: string) {
    try {
      await page.goto(url);
      await timeout(NAVIGATION_EXTRA_TIMEOUT_MS);
      const targetUrl = page.url();
      const formStructures = await getFormStructures(page);
      logRecords.push({ type: "navigate", url, targetUrl, formStructures });
      return { targetUrl, formStructures };
    } catch (e) {
      logRecords.push({
        type: "navigate-error",
        reason: e instanceof Error ? e.stack! : String(e),
      });
      throw e;
    }
  }

  async function collectCandidateEntries(
    keywordsRegExp: RegExp
  ): Promise<CandidateEntry[]> {
    const candidateUrls = await page
      .locator("a", { hasText: keywordsRegExp })
      .evaluateAll((anchors) =>
        anchors.map((a) =>
          new URL((a as HTMLAnchorElement).href, document.baseURI).toString()
        )
      );
    return candidateUrls.map((url) => ({ url }));
  }

  async function crawl(
    candidateEntries: CandidateEntry[],
    ttl?: number
  ): Promise<string | null> {
    ttl !== void 0 || (ttl = 1);
    logRecords.push({ type: "crawl", candidateEntries });
    for (const { url: candidateUrl } of candidateEntries) {
      try {
        const { formStructures } = await navigate(candidateUrl);
        if (detectSignupPage(formStructures)) {
          return candidateUrl;
        } /* else if (detectLoginPage(formStructures)) */ else {
          if (ttl > 0) {
            const signupPageUrl = await crawl(
              (
                await collectCandidateEntries(SIGNUP_REGEXP)
              ).slice(0, MAX_CANDIDATE_URLS_PER_PAGE),
              ttl - 1
            );
            if (signupPageUrl) {
              return signupPageUrl;
            }
          }
        }
      } catch {
        /* suppress */
      }
    }
    return null;
  }

  // (1) We search for a signup form on the domain’s landing page.
  // NOTE: here we also check whether the domain is accessible
  {
    logRecords.push({ type: "init-step", step: 1 });
    const { targetUrl: landingPageUrl, formStructures } = await navigate(
      `http://${domain}/`
    );
    if (detectSignupPage(formStructures)) {
      return createResult(landingPageUrl);
    }
  }

  // (2) We next crawl URL links found on the landing page that contain common
  // keywords for account signup (or login) URLs.
  {
    logRecords.push({ type: "init-step", step: 2 });
    const candidateEntries = [
      ...(await collectCandidateEntries(SIGNUP_REGEXP)),
      ...(await collectCandidateEntries(LOGIN_REGEXP)),
    ];
    const signupPageUrl = await crawl(
      candidateEntries.slice(0, MAX_CANDIDATE_URLS_PER_PAGE)
    );
    if (signupPageUrl) {
      return createResult(signupPageUrl);
    }
  }

  // (3) Query a search engine (Bing) for the domain’s account signup pages.
  {
    logRecords.push({ type: "init-step", step: 3 });
    await page.goto(`https://www.bing.com/search?q=${domain}+signup`);
    const candidateEntries = (
      await page
        .locator("#b_results > li.b_algo h2 a")
        .evaluateAll((anchors) =>
          anchors.map((a) => (a as HTMLAnchorElement).href)
        )
    ).map((url) => ({ url }));
    const signupPageUrl = await crawl(
      candidateEntries.slice(0, MAX_CANDIDATE_URLS_PER_PAGE)
    );
    if (signupPageUrl) {
      return createResult(signupPageUrl);
    }
  }

  return createResult(null);
}
