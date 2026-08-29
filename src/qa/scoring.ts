import type { QACheck, QAScore, CardStructure, CTA, ImagePlan, StyleProfile } from "../core/types.js";
import { QA_PASS_THRESHOLD } from "../core/constants.js";

/**
 * Scoring Engine (PRD §14, DESIGN §35, SKILL §33).
 *
 * Deterministic scoring across the six weighted dimensions. Hard fails are
 * handled separately by the orchestrator; scoring reflects aesthetic/clarity
 * quality and drives the rewrite loop.
 */
export function computeScore(input: {
  checks: QACheck[];
  structure: CardStructure;
  ctas: CTA[];
  imagePlan?: ImagePlan;
  style: StyleProfile;
}): QAScore {
  const { checks, structure, ctas, imagePlan, style } = input;

  const issuesByStage = (stage: string) =>
    checks.flatMap((c) => c.issues).filter((i) => i.stage === stage);

  const penalty = (stage: string, perError: number, perWarning: number) => {
    const issues = issuesByStage(stage);
    return issues.reduce((acc, i) => acc + (i.severity === "warning" ? perWarning : perError), 0);
  };

  // Information Clarity /30
  let informationClarity = 30 - penalty("information_qa", 8, 3) - penalty("fact_qa", 4, 1);
  // Attention Hierarchy /20 — reward single primary anchor + <=3 secondary anchors.
  let attentionHierarchy = 20;
  if (!structure.primaryAnchor) attentionHierarchy -= 10;
  const primaryCtas = ctas.filter((c) => c.priority === "primary").length;
  if (primaryCtas > 1) attentionHierarchy -= 6;
  // Action Clarity /15
  let actionClarity = 15 - penalty("navigation_qa", 5, 2);
  if (ctas.length === 0) actionClarity -= 3;
  // Brand Consistency /15
  let brandConsistency = 15 - penalty("brand_qa", 6, 2);
  if (style.isBrandResolved) brandConsistency = Math.min(15, brandConsistency + 1);
  // Visual Quality /10
  let visualQuality = 10 - penalty("image_qa", 4, 1);
  if (imagePlan && imagePlan.mobile_readable_without_zoom === false) visualQuality -= 3;
  // Feishu Native /10
  let feishuNativeExperience = 10 - penalty("feishu_qa", 5, 1) - penalty("mobile_qa", 3, 1);

  const clamp = (v: number, max: number) => Math.max(0, Math.min(max, Math.round(v)));
  informationClarity = clamp(informationClarity, 30);
  attentionHierarchy = clamp(attentionHierarchy, 20);
  actionClarity = clamp(actionClarity, 15);
  brandConsistency = clamp(brandConsistency, 15);
  visualQuality = clamp(visualQuality, 10);
  feishuNativeExperience = clamp(feishuNativeExperience, 10);

  const total =
    informationClarity +
    attentionHierarchy +
    actionClarity +
    brandConsistency +
    visualQuality +
    feishuNativeExperience;

  return {
    informationClarity,
    attentionHierarchy,
    actionClarity,
    brandConsistency,
    visualQuality,
    feishuNativeExperience,
    total,
  };
}

export function isPassingScore(score: QAScore): boolean {
  return score.total >= QA_PASS_THRESHOLD;
}
