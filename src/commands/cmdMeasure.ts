import DataAccessObject, { checkAnalysisType } from "../core/DataAccessObject";
import { Completion, isFailure } from "../util/Completion";
import { PASSWORD_FIELD_INPUT_ANALYSIS_TYPE } from "./cmdPasswordFieldInput";
import { SAMPLE_STRONG_PASSWORD } from "../core/inputPasswordField";
import { SearchSignupPageResult } from "../core/searchSignupPage";
import { SIGNUP_PAGE_SEARCH_ANALYSIS_TYPE } from "./cmdSignupPageSearch";
import { writeFileSync } from "fs";
import {
  FunctionCall,
  PasswordFieldInputResult,
} from "../core/PasswordFieldInputResult";

const PSM_REGEXP: RegExp =
  /weak|so-so|good|great|fair|strong|medium|best|okay|perfect|poor|moderate|excellent|low|high|strength|security|level/i;

const PVW_REGEXP: RegExp =
  /word|letter|character|upper[\s-]?case|lower[\s-]?case|digit|number|symbol|special/i;

export default function cmdMeasure(args: {
  pfiAnalysisId: number;
  dbFilepath: string | undefined;
}) {
  const dao = DataAccessObject.open(args.dbFilepath);

  const { pfiAnalysisId } = args;
  const pfiAnalysisModel = dao.getAnalysis(pfiAnalysisId);
  checkAnalysisType(pfiAnalysisModel, PASSWORD_FIELD_INPUT_ANALYSIS_TYPE);
  const spsAnalysisId = pfiAnalysisModel.parentAnalysisId!;
  const spsAnalysisModel = dao.getAnalysis(spsAnalysisId);
  checkAnalysisType(spsAnalysisModel, SIGNUP_PAGE_SEARCH_ANALYSIS_TYPE);

  let accessibleDomainsCount = 0;
  let signupPagesCount = 0;

  for (const domainModel of dao.getDoneDomains(spsAnalysisId)) {
    const spsCompletion = dao.getAnalysisResult(
      spsAnalysisId,
      domainModel.id
    ) as Completion<SearchSignupPageResult>;

    if (isFailure(spsCompletion)) continue;
    const { value: spsResult } = spsCompletion;

    accessibleDomainsCount += 1;

    if (spsResult.signupPageUrl !== null) {
      signupPagesCount += 1;
    }
  }

  let pfiDomainsCount = 0;
  const hasPasswordWidgetDomains: string[] = [];
  const relevantFunctionCalls: FunctionCall[] = [];
  let mutationDomainsCount = 0;
  const mutatedAttributesRanking = new Map<string, number>();
  const mutatedTexts: string[] = [];

  for (const domainModel of dao.getDoneDomains(pfiAnalysisId)) {
    const pfiCompletion = dao.getAnalysisResult(
      pfiAnalysisId,
      domainModel.id
    ) as Completion<PasswordFieldInputResult>;
    if (isFailure(pfiCompletion)) continue;
    const { value: pfiResult } = pfiCompletion;
    if (!pfiResult) continue; // TODO: fix status is success but value is undefined (serialization issue?)

    pfiDomainsCount += 1;

    const trace = pfiResult.traceStrongFill;

    if (trace.mutations.length > 0) {
      hasPasswordWidgetDomains.push(domainModel.domain);
    }

    for (const functionCall of trace.functionCalls) {
      if (functionCall.args.includes(SAMPLE_STRONG_PASSWORD)) {
        relevantFunctionCalls.push(functionCall);
      }
    }

    if (trace.mutations.length > 0) {
      mutationDomainsCount += 1;
    }
    const mutatedAttributes = new Set<string>();
    for (const mutation of trace.mutations) {
      switch (mutation.type) {
        case "attributes":
          mutatedAttributes.add(mutation.attributeName); // TODO: add innerText
          break;
        case "characterData":
          mutatedTexts.push(mutation.value);
          break;
        case "childList":
          for (const text of mutation.addedTexts) {
            mutatedTexts.push(text);
          }
          break;
      }
    }
    for (const attribute of mutatedAttributes) {
      mutatedAttributesRanking.set(
        attribute,
        (mutatedAttributesRanking.get(attribute) ?? 0) + 1
      );
    }
  }

  const report = {
    accessibleDomainsCount,
    signupPagesCount,
    pfiDomainsCount,
    hasPasswordWidgetDomains,
    relevantFunctionCalls,
    mutationDomainsCount,
    mutatedAttributesRanking: Object.fromEntries(
      [...mutatedAttributesRanking].sort(([, a], [, b]) => b - a)
    ),
    mutatedTexts: [...new Set(mutatedTexts)],
    mutatedTextsCount: mutatedTexts.length,
    psmMutatedTextsCount: mutatedTexts.filter((text) => PSM_REGEXP.test(text))
      .length,
    pvwMutatedTextsCount: mutatedTexts.filter((text) => PVW_REGEXP.test(text))
      .length,
  };

  writeFileSync("output.json", JSON.stringify(report, undefined, 2));

  process.exit(0);
}
