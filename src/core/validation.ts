import { z } from "zod";

/**
 * Runtime validation schemas (SPEC §4). We validate the artifacts we produce
 * so that any drift is caught before writing the output bundle.
 */

export const FactFieldSchema = z.object({
  id: z.string(),
  value: z.string(),
  source_text: z.string(),
  start: z.number().optional(),
  end: z.number().optional(),
  locked: z.boolean(),
  normalization: z
    .object({
      source: z.string(),
      normalized: z.string(),
      semantic_equal: z.literal(true),
    })
    .optional(),
});

export const DeadlineFactSchema = FactFieldSchema.extend({
  date: z.string(),
  action: z.string().optional(),
});

export const ActionFactSchema = FactFieldSchema.extend({
  action: z.string(),
  target_url: z.string().optional(),
});

export const LinkFactSchema = FactFieldSchema.extend({
  url: z.string(),
  type: z.string().optional(),
});

export const SourceOfTruthSchema = z.object({
  project_name: z.string().optional(),
  activity_name: z.string().optional(),
  card_purpose: z.string().optional(),
  dates: z.array(FactFieldSchema),
  times: z.array(FactFieldSchema),
  deadlines: z.array(DeadlineFactSchema),
  locations: z.array(FactFieldSchema),
  people: z.array(FactFieldSchema),
  actions: z.array(ActionFactSchema),
  links: z.array(LinkFactSchema),
  submission_requirements: z.array(FactFieldSchema),
  rules: z.array(FactFieldSchema),
  rewards: z.array(FactFieldSchema),
  status: z.array(FactFieldSchema),
  brand_entities: z.array(FactFieldSchema),
  ai_editable_sections: z.array(
    z.object({ id: z.string(), text: z.string(), role: z.string() }),
  ),
  uncertain_information: z.array(
    z.object({ id: z.string(), note: z.string(), source_text: z.string().optional() }),
  ),
  raw_copy_hash: z.string(),
});

export const CardIntentEnum = z.enum([
  "timeline",
  "deadline",
  "training",
  "submission",
  "case_showcase",
  "announcement",
  "registration",
  "result",
  "award",
  "reminder",
  "countdown",
  "guide",
  "custom",
]);

export const CardIntentResultSchema = z.object({
  primary_intent: CardIntentEnum,
  primary_question: z.string(),
  primary_action: z.string(),
  primary_attention_anchor: z.string(),
  secondary_attention_anchor: z.array(z.string()).max(3),
  recommended_layout: z.string(),
  recommended_interactions: z.array(z.string()),
  confidence: z.number().min(0).max(1),
});

export const RenderModeResultSchema = z.object({
  render_mode: z.enum(["text_first", "image_assisted", "image_led_navigation"]),
  cta_mode: z.enum(["single", "multi"]),
  image_required: z.boolean(),
  reason: z.string(),
});

export const ImageIntentResultSchema = z.object({
  image_mode: z.enum(["required", "recommended", "optional", "not_needed"]),
  image_role: z.enum([
    "hero_summary",
    "schedule_overview",
    "module_summary",
    "scene_navigation",
    "case_summary",
    "none",
  ]),
  reason: z.string(),
  text_to_image_ratio: z.enum(["70_30", "50_50", "30_70"]),
});

export const CTASchema = z.object({
  id: z.string(),
  label: z.string(),
  type: z.enum(["url", "callback"]),
  url: z.string().optional(),
  linkTarget: z
    .object({
      universal: z.string().optional(),
      pc: z.string().optional(),
      ios: z.string().optional(),
      android: z.string().optional(),
    })
    .optional(),
  callbackKey: z.string().optional(),
  priority: z.enum(["primary", "secondary"]),
  sourceFactId: z.string().optional(),
  mapsToImageModule: z.string().optional(),
});

export const MobileLayoutPlanSchema = z.object({
  mobile_first: z.literal(true),
  readingOrder: z.array(z.string()),
  columnStrategy: z.enum(["single", "limited_two_column"]),
  primaryAnchorPosition: z.literal("top"),
  primaryCTAPlacement: z.enum(["early", "after_primary_content"]),
  secondaryCTAStyle: z.enum(["stacked", "two_column"]),
  maxSecondaryCTAPerRow: z.union([z.literal(1), z.literal(2)]),
  imageMode: z.enum(["hero", "information", "none"]),
  imageReadableWithoutZoom: z.boolean(),
  criticalFactsAboveFold: z.array(z.string()),
  warnings: z.array(z.string()),
});
