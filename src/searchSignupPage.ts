import detectSignupPage from "./detectSignupPage";
import getFormStructures from "./getFormStructures";
import timeout from "./timeout";
import { Page } from "playwright";

const SIGNUP_REGEXP: RegExp = /sign\s?up|register|create|join/i;

const LOGIN_REGEXP: RegExp = /log\s?[io]n|sign\s?[io]n/i;

const NAVIGATION_EXTRA_TIMEOUT_MS: number = 5000;

const MAX_CANDIDATE_URLS_PER_PAGE: number = 4;

interface CandidateEntry {
  url: string;
}

// signup page search à la Alroomi et Li
export default async function searchSignupPage(
  page: Page,
  domain: string
): Promise<string | undefined> {
  async function navigate(url: string) {
    await page.goto(url);
    await timeout(NAVIGATION_EXTRA_TIMEOUT_MS);
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
  ): Promise<string | undefined> {
    ttl !== void 0 || (ttl = 1);
    for (const { url: candidateUrl } of candidateEntries) {
      try {
        await navigate(candidateUrl);
        const formStructures = await getFormStructures(page);
        if (detectSignupPage(formStructures)) {
          return candidateUrl;
        } /* else if (detectLoginPage(formStructures)) */ else {
          if (ttl > 0) {
            const result = await crawl(
              (
                await collectCandidateEntries(SIGNUP_REGEXP)
              ).slice(0, MAX_CANDIDATE_URLS_PER_PAGE),
              ttl - 1
            );
            if (result) {
              return result;
            }
          }
        }
      } catch {
        /* suppress */
      }
    }
  }

  // (1) We search for a signup form on the domain’s landing page.
  // NOTE: here we also check whether the domain is accessible
  {
    await navigate(`http://${domain}/`);
    const landingPageUrl = page.url();
    const formStructures = await getFormStructures(page);
    if (detectSignupPage(formStructures)) {
      return landingPageUrl;
    }
  }

  // (2) We next crawl URL links found on the landing page that contain common
  // keywords for account signup (or login) URLs.
  {
    const candidateEntries = [
      ...(await collectCandidateEntries(SIGNUP_REGEXP)),
      ...(await collectCandidateEntries(LOGIN_REGEXP)),
    ];
    const result = await crawl(
      candidateEntries.slice(0, MAX_CANDIDATE_URLS_PER_PAGE)
    );
    if (result) {
      return result;
    }
  }

  // (3) Query a search engine (Bing) for the domain’s account signup pages.
  {
    await page.goto(`https://www.bing.com/search?q=${domain}+signup`);
    const candidateEntries = (
      await page
        .locator("#b_results > li.b_algo h2 a")
        .evaluateAll((anchors) =>
          anchors.map((a) => (a as HTMLAnchorElement).href)
        )
    ).map((url) => ({ url }));
    const result = await crawl(
      candidateEntries.slice(0, MAX_CANDIDATE_URLS_PER_PAGE)
    );
    if (result) {
      return result;
    }
  }
}
