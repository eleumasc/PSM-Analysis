import { Page } from "playwright";
import installReplayer from "./installReplayer";

export default function installAnalysis(page: Page, replayHarPath: string) {
  return installReplayer(page, replayHarPath, {
    analysisMode: true,
  });
}
