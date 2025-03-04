import _ from "lodash";
import {
  computePSMSimilarity,
  ScoringEntry,
} from "../core/computePSMSimilarity";

const testCases: ScoringEntry[][] = [
  // same scores
  [
    { frequency: 1, referenceScore: 1, evaluatedScore: 1 },
    { frequency: 1, referenceScore: 2, evaluatedScore: 2 },
    { frequency: 1, referenceScore: 3, evaluatedScore: 3 },
    { frequency: 1, referenceScore: 4, evaluatedScore: 4 },
  ],
  // opposite scores
  [
    { frequency: 1, referenceScore: 1, evaluatedScore: 4 },
    { frequency: 1, referenceScore: 2, evaluatedScore: 3 },
    { frequency: 1, referenceScore: 3, evaluatedScore: 2 },
    { frequency: 1, referenceScore: 4, evaluatedScore: 1 },
  ],
  // x-translated scores
  [
    { frequency: 1, referenceScore: 2, evaluatedScore: 1 },
    { frequency: 1, referenceScore: 3, evaluatedScore: 2 },
    { frequency: 1, referenceScore: 4, evaluatedScore: 3 },
    { frequency: 1, referenceScore: 1, evaluatedScore: 4 },
  ],
  // y-translated scores
  [
    { frequency: 1, referenceScore: 1, evaluatedScore: 2 },
    { frequency: 1, referenceScore: 2, evaluatedScore: 3 },
    { frequency: 1, referenceScore: 3, evaluatedScore: 4 },
    { frequency: 1, referenceScore: 4, evaluatedScore: 1 },
  ],
  // repeated scores [NaN]
  [
    { frequency: 1, referenceScore: 1, evaluatedScore: 1 },
    { frequency: 1, referenceScore: 2, evaluatedScore: 1 },
    { frequency: 1, referenceScore: 3, evaluatedScore: 1 },
    { frequency: 1, referenceScore: 4, evaluatedScore: 4 },
  ],
  // same scores, different weights
  [
    { frequency: 1, referenceScore: 1, evaluatedScore: 1 },
    { frequency: 2, referenceScore: 2, evaluatedScore: 2 },
    { frequency: 3, referenceScore: 3, evaluatedScore: 3 },
    { frequency: 4, referenceScore: 4, evaluatedScore: 4 },
  ],
  // x-translated scores, different weights
  [
    { frequency: 1, referenceScore: 2, evaluatedScore: 1 },
    { frequency: 2, referenceScore: 3, evaluatedScore: 2 },
    { frequency: 3, referenceScore: 4, evaluatedScore: 3 },
    { frequency: 4, referenceScore: 1, evaluatedScore: 4 },
  ],
];

for (const [index, testCase] of Object.entries(testCases)) {
  console.log(`Test ${+index + 1}`, computePSMSimilarity(testCase));
}
