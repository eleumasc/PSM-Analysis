import detectLoginOrRegisterPage from "./detectLoginOrRegisterPage";
import timeout from "./timeout";
import { Page } from "playwright";

const REGISTER_REGEXP: RegExp = /sign\s?up|register|create|join/i;

const LOGIN_REGEXP: RegExp = /log\s?[io]n|sign\s?[io]n/i;

const NAVIGATION_EXTRA_TIMEOUT_MS: number = 10000;

const MAX_CANDIDATE_URLS_PER_PAGE: number = 4;

// register page search à la Alroomi et Li
export default async function searchRegisterPage(
  page: Page,
  domain: string
): Promise<string | undefined> {
  async function navigate(url: string) {
    await page.goto(url);
    await timeout(NAVIGATION_EXTRA_TIMEOUT_MS);
  }

  async function collectCandidateUrls(keywordsRegExp: RegExp) {
    return page
      .locator("a", { hasText: keywordsRegExp })
      .evaluateAll((anchors) =>
        anchors.map((a) =>
          new URL((a as HTMLAnchorElement).href, document.baseURI).toString()
        )
      );
  }

  async function crawl(candidateUrls: string[]) {
    for (const candidateUrl of candidateUrls) {
      await navigate(candidateUrl);
      const detectResult = await detectLoginOrRegisterPage(page);
      if (detectResult.registerPageDetected) {
        return candidateUrl;
      } else if (detectResult.loginPageDetected) {
        for (const candidateUrl of (
          await collectCandidateUrls(REGISTER_REGEXP)
        ).slice(0, MAX_CANDIDATE_URLS_PER_PAGE)) {
          await navigate(candidateUrl);
          const detectResult = await detectLoginOrRegisterPage(page);
          if (detectResult.registerPageDetected) {
            return candidateUrl;
          }
        }
      }
    }
  }

  // (1) We search for a register form on the domain’s landing page.
  // NOTE: here we also check whether the domain is accessible
  {
    await navigate(`http://${domain}/`);
    const landingPageUrl = page.url();
    const detectResult = await detectLoginOrRegisterPage(page);
    if (detectResult.registerPageDetected) {
      return landingPageUrl;
    }
  }

  // (2) We next crawl URL links found on the landing page that contain common
  // keywords for account register (or login) URLs.
  {
    const candidateUrls = [
      ...(await collectCandidateUrls(REGISTER_REGEXP)),
      ...(await collectCandidateUrls(LOGIN_REGEXP)),
    ];
    const result = await crawl(
      candidateUrls.slice(0, MAX_CANDIDATE_URLS_PER_PAGE)
    );
    if (result) {
      return result;
    }
  }

  // (3) Query a search engine (Bing) for the domain’s account signup pages.
  {
    await page.goto(`https://www.bing.com/search?q=${domain}+signup`);
    const candidateUrls = await page
      .locator("#b_results > li.b_algo h2 a")
      .evaluateAll((anchors) =>
        anchors.map((a) => (a as HTMLAnchorElement).href)
      );
    const result = await crawl(
      candidateUrls.slice(0, MAX_CANDIDATE_URLS_PER_PAGE)
    );
    if (result) {
      return result;
    }
  }
}
