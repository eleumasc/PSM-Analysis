import findRegisterForm from "./findRegisterForm";
import getFormStructures, { FormStructure } from "./getFormStructures";
import { Page } from "playwright";
import { timeout } from "../util/timeout";

const SIGNUP_REGEXP: RegExp = /sign([^0-9a-zA-Z]|\s)*up|regist(er|ration)?|join|(create|new)([^0-9a-zA-Z]|\s)*(new([^0-9a-zA-Z]|\s)*)?(acc(ount)?|us(e)?r|prof(ile)?)/i;

const LOGIN_REGEXP: RegExp = /(log|sign)([^0-9a-zA-Z]|\s)*(in|on)|authenticat(e|ion)|\/(my([^0-9a-zA-Z]|\s)*)?(user|account|profile|dashboard)/i;

const NAVIGATE_EXTRA_TIMEOUT_MS: number = 5000;

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

export type SearchRegisterPageResult = {
  registerPageUrl: string | null;
  logRecords: LogRecord[];
};

// register page search à la Alroomi et Li
export default async function searchRegisterPage(
  page: Page,
  site: string
): Promise<SearchRegisterPageResult> {
  const logRecords: LogRecord[] = [];

  function createResult(registerPageUrl: string | null): SearchRegisterPageResult {
    return { registerPageUrl, logRecords };
  }

  async function navigate(url: string) {
    try {
      await page.goto(url);
      await timeout(NAVIGATE_EXTRA_TIMEOUT_MS);
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
        if (findRegisterForm(formStructures)) {
          return candidateUrl;
        } /* else if (detectLoginPage(formStructures)) */ else {
          if (ttl > 0) {
            const registerPageUrl = await crawl(
              (
                await collectCandidateEntries(SIGNUP_REGEXP)
              ).slice(0, MAX_CANDIDATE_URLS_PER_PAGE),
              ttl - 1
            );
            if (registerPageUrl) {
              return registerPageUrl;
            }
          }
        }
      } catch {
        /* suppress */
      }
    }
    return null;
  }

  // (1) We search for a register form on the site’s landing page.
  // NOTE: here we also check whether the site is accessible
  {
    logRecords.push({ type: "init-step", step: 1 });
    const { targetUrl: landingPageUrl, formStructures } = await navigate(
      `http://${site}/`
    );
    if (findRegisterForm(formStructures)) {
      return createResult(landingPageUrl);
    }
  }

  // (2) We next crawl URL links found on the landing page that contain common
  // keywords for account register (or login) URLs.
  {
    logRecords.push({ type: "init-step", step: 2 });
    const candidateEntries = [
      ...(await collectCandidateEntries(SIGNUP_REGEXP)),
      ...(await collectCandidateEntries(LOGIN_REGEXP)),
    ];
    const registerPageUrl = await crawl(
      candidateEntries.slice(0, MAX_CANDIDATE_URLS_PER_PAGE)
    );
    if (registerPageUrl) {
      return createResult(registerPageUrl);
    }
  }

  // (3) Query a search engine (Bing) for the site’s account register pages.
  {
    logRecords.push({ type: "init-step", step: 3 });
    await page.goto(`https://www.bing.com/search?q=${site}+register`);
    const candidateEntries = (
      await page
        .locator("#b_results > li.b_algo h2 a")
        .evaluateAll((anchors) =>
          anchors.map((a) => (a as HTMLAnchorElement).href)
        )
    ).map((url) => ({ url }));
    const registerPageUrl = await crawl(
      candidateEntries.slice(0, MAX_CANDIDATE_URLS_PER_PAGE)
    );
    if (registerPageUrl) {
      return createResult(registerPageUrl);
    }
  }

  return createResult(null);
}
