import type {
  QAReport,
  QACheck,
  QAIssue,
  SourceOfTruth,
  CardStructure,
  CardIntentResult,
  CTA,
  ImagePlan,
  StyleProfile,
  MobileLayoutPlan,
  CrossDeviceQAResult,
} from "../core/types.js";
import { runFactQA } from "./fact-qa.js";
import { runInformationQA } from "./information-qa.js";
import { runImageQA, runNavigationQA } from "./image-navigation-qa.js";
import { runBrandQA, runFeishuQA } from "./brand-feishu-qa.js";
import { runMobileQA, runCrossDeviceQA } from "./mobile-qa.js";
import { computeScore } from "./scoring.js";

/**
 * QA Orchestrator (PRD §13, SPEC §19). Runs the full pipeline in order:
 * Fact -> Information -> Image -> Navigation -> Brand -> Feishu -> Mobile ->
 * Cross-device. Aggregates a report with score + hard-fail flag.
 */
export interface QAInput {
  sot: SourceOfTruth;
  rawCopy: string;
  cardText: string;
  structure: CardStructure;
  intent: CardIntentResult;
  ctas: CTA[];
  imagePlan?: ImagePlan;
  style: StyleProfile;
  cardJson: any;
  mobileLayout: MobileLayoutPlan;
  primaryCtaMobileUsable: boolean;
}

export function runQA(input: QAInput): { report: QAReport; crossDevice: CrossDeviceQAResult } {
  const checks: QACheck[] = [];

  checks.push(runFactQA({ sot: input.sot, rawCopy: input.rawCopy, cardText: input.cardText, ctas: input.ctas }));
  checks.push(runInformationQA({ structure: input.structure, intent: input.intent, ctas: input.ctas, cardText: input.cardText }));
  checks.push(runImageQA({ imagePlan: input.imagePlan, ctas: input.ctas, cardText: input.cardText }));
  checks.push(runNavigationQA({ ctas: input.ctas }));
  checks.push(runBrandQA({ style: input.style, cardJson: input.cardJson }));
  checks.push(runFeishuQA({ cardJson: input.cardJson, ctas: input.ctas }));

  const mobileCheck = runMobileQA({
    mobileLayout: input.mobileLayout,
    ctas: input.ctas,
    imagePlan: input.imagePlan,
    primaryCtaMobileUsable: input.primaryCtaMobileUsable,
  });
  checks.push(mobileCheck);

  const crossDevice = runCrossDeviceQA({
    mobileCheck,
    primaryCtaMobileUsable: input.primaryCtaMobileUsable,
    hasImage: !!input.imagePlan,
  });

  const allIssues: QAIssue[] = checks.flatMap((c) => c.issues);
  const hardFail = allIssues.some((i) => i.severity === "hard_fail") || !crossDevice.overallPass;

  const score = computeScore({
    checks,
    structure: input.structure,
    ctas: input.ctas,
    imagePlan: input.imagePlan,
    style: input.style,
  });

  const pass = !hardFail && score.total >= 85;

  const report: QAReport = {
    checks,
    score,
    pass,
    hardFail,
    issues: allIssues,
    rewrites: 0,
  };

  return { report, crossDevice };
}
