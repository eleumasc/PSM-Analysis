import DataAccessObject, { checkAnalysisType } from "../core/DataAccessObject";
import { Completion, isFailure } from "../util/Completion";
import { PASSWORD_FIELD_INPUT_ANALYSIS_TYPE } from "./cmdPasswordFieldInput";
import { SAMPLE_PASSWORD } from "../core/inputPasswordField";
import { SearchSignupPageResult } from "../core/searchSignupPage";
import { SIGNUP_PAGE_SEARCH_ANALYSIS_TYPE } from "./cmdSignupPageSearch";
import { writeFileSync } from "fs";
import {
  FunctionCall,
  PasswordFieldInputResult,
} from "../core/PasswordFieldInputResult";

const PSM_REGEXP: RegExp =
  /weak|average|intermediate|medium|so-so|strong|password|strength|characters|letters|digits|numbers|symbols/i;

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
    const completion = dao.getAnalysisResult(
      spsAnalysisId,
      domainModel.id
    ) as Completion<SearchSignupPageResult>;

    if (isFailure(completion)) continue;
    const { value: spsResult } = completion;

    accessibleDomainsCount += 1;

    if (spsResult.signupPageUrl !== null) {
      signupPagesCount += 1;
    }
  }

  let pfiDomainsCount = 0;
  const relevantFunctionCalls: FunctionCall[] = [];
  let mutationDomainsCount = 0;
  const mutatedAttributesRanking = new Map<string, number>();
  const mutatedTexts = new Set<string>();

  for (const domainModel of dao.getDoneDomains(pfiAnalysisId)) {
    const completion = dao.getAnalysisResult(
      pfiAnalysisId,
      domainModel.id
    ) as Completion<PasswordFieldInputResult>;

    if (isFailure(completion)) continue;
    const { value: pfiResult } = completion;
    if (!pfiResult) continue; // TODO: fix status is success but value is undefined (serialization issue?)

    pfiDomainsCount += 1;

    for (const functionCall of pfiResult.functionCalls) {
      if (functionCall.args.includes(SAMPLE_PASSWORD)) {
        relevantFunctionCalls.push(functionCall);
      }
    }

    if (pfiResult.mutations.length > 0) {
      mutationDomainsCount += 1;
    }
    const mutatedAttributes = new Set<string>();
    for (const mutation of pfiResult.mutations) {
      switch (mutation.type) {
        case "attributes":
          mutatedAttributes.add(mutation.attributeName); // TODO: add innerText
          break;
        case "characterData":
          mutatedTexts.add(mutation.value);
          break;
        case "childList":
          for (const text of mutation.addedTexts) {
            mutatedTexts.add(text);
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

  writeFileSync(
    "output.json",
    JSON.stringify(
      {
        accessibleDomainsCount,
        signupPagesCount,
        pfiDomainsCount,
        relevantFunctionCalls,
        mutationDomainsCount,
        mutatedAttributesRanking: Object.fromEntries(
          [...mutatedAttributesRanking].sort(([, a], [, b]) => b - a)
        ),
        mutatedTexts: [...mutatedTexts],
        mutatedTextsCount: [...mutatedTexts].length,
        filteredMutatedTextsCount: [...mutatedTexts].filter((text) =>
          PSM_REGEXP.test(text)
        ).length,
      },
      undefined,
      2
    )
  );

  process.exit(0);
}
