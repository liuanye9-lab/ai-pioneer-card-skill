/**
 * Core domain types for the AI先锋大赛 Feishu Card Skill.
 *
 * These types are shared across every pipeline stage. They intentionally
 * mirror the data objects defined in PRD §11 and SPEC §4 so that every
 * intermediate artifact is inspectable and editable.
 */

// ---------------------------------------------------------------------------
// Raw input
// ---------------------------------------------------------------------------

export interface KnownLink {
  label?: string;
  url: string;
  type?: string;
}

export interface RawInput {
  /** The raw, un-processed activity copy. The single source of truth. */
  copy: string;
  /** Optional explicit instruction (e.g. "帮我把结尾润色一下"). */
  userInstruction?: string;
  /** Explicit brand name; triggers brand style resolution. */
  brandName?: string;
  /** Reference image paths/urls (only used when user explicitly provides). */
  referenceImages?: string[];
  /** Links the user already knows are valid — never invented. */
  knownLinks?: KnownLink[];
  /** Where the card would be published (used only for real send tests). */
  publishTarget?: { chatId?: string };
  /** Slug for the output bundle folder; auto-derived when absent. */
  slug?: string;
  /** Intent to publish (send) the card — triggers risk-confirmation gate. */
  wantSend?: boolean;
  /** Explicit human confirmation that sending is authorized. */
  confirmSend?: boolean;
  /**
   * A real Feishu img_key (produced by FeishuCardAdapter.uploadImage or supplied
   * by the caller). When present AND an image is planned, the card renders a
   * native img element; otherwise the native-text fallback stays (never a fake
   * key — a placeholder img breaks the real send).
   */
  heroImageKey?: string;
}

// ---------------------------------------------------------------------------
// Facts & Source of Truth
// ---------------------------------------------------------------------------

export type LockedFactType =
  | "activity_name"
  | "project_name"
  | "brand_name"
  | "person_name"
  | "date"
  | "time"
  | "deadline"
  | "number"
  | "location"
  | "url"
  | "reward"
  | "rule"
  | "submission_requirement";

export interface FactField {
  /** Stable id used to trace card content back to a fact. */
  id: string;
  /** Normalized/displayed value. */
  value: string;
  /** Original text evidence span from the raw copy. */
  source_text: string;
  start?: number;
  end?: number;
  locked: boolean;
  /** Records semantic-equivalent normalization (e.g. 8.9 -> 8月9日). */
  normalization?: {
    source: string;
    normalized: string;
    semantic_equal: true;
  };
}

export interface DeadlineFact extends FactField {
  date: string;
  action?: string;
}

export interface ActionFact extends FactField {
  /** verb + object, e.g. "提交作品". */
  action: string;
  target_url?: string;
}

export interface LinkFact extends FactField {
  url: string;
  type?: string; // submission | doc | bitable | meeting | external | ...
}

export interface EditableSection {
  id: string;
  text: string;
  role: string; // supporting | cta_hint | tone | ...
}

export interface UncertainFact {
  id: string;
  note: string;
  source_text?: string;
}

export interface SourceOfTruth {
  project_name?: string;
  activity_name?: string;
  card_purpose?: string;

  dates: FactField[];
  times: FactField[];
  deadlines: DeadlineFact[];
  locations: FactField[];
  people: FactField[];
  actions: ActionFact[];
  links: LinkFact[];
  submission_requirements: FactField[];
  rules: FactField[];
  rewards: FactField[];
  status: FactField[];
  brand_entities: FactField[];

  ai_editable_sections: EditableSection[];
  uncertain_information: UncertainFact[];

  raw_copy_hash: string;
}

// ---------------------------------------------------------------------------
// Intent / Render mode / Image intent
// ---------------------------------------------------------------------------

export type CardIntent =
  | "timeline"
  | "deadline"
  | "training"
  | "submission"
  | "case_showcase"
  | "announcement"
  | "registration"
  | "result"
  | "award"
  | "reminder"
  | "countdown"
  | "guide"
  | "custom";

export interface CardIntentResult {
  primary_intent: CardIntent;
  primary_question: string;
  primary_action: string;
  primary_attention_anchor: string;
  secondary_attention_anchor: string[];
  recommended_layout: string;
  recommended_interactions: string[];
  confidence: number;
}

export type RenderMode = "text_first" | "image_assisted" | "image_led_navigation";

export interface RenderModeResult {
  render_mode: RenderMode;
  cta_mode: "single" | "multi";
  image_required: boolean;
  reason: string;
}

export type ImageMode = "required" | "recommended" | "optional" | "not_needed";
export type ImageRole =
  | "hero_summary"
  | "schedule_overview"
  | "module_summary"
  | "scene_navigation"
  | "case_summary";

export interface ImageIntentResult {
  image_mode: ImageMode;
  image_role: ImageRole | "none";
  reason: string;
  text_to_image_ratio: "70_30" | "50_50" | "30_70";
}

// ---------------------------------------------------------------------------
// Attention & Information Architecture
// ---------------------------------------------------------------------------

export interface AttentionPlan {
  primary_anchor: string;
  secondary_anchors: string[]; // <= 3
  supporting: string[];
}

export type BlockType = "text" | "timeline" | "badge" | "columns" | "image" | "note";

export interface ContentBlock {
  id: string;
  type: BlockType;
  priority: 1 | 2 | 3;
  content: any;
  sourceFactIds?: string[];
}

export interface HeaderBlock {
  logo?: string;
  activityName: string;
  badge?: string;
  subtitle?: string;
}

export interface CardStructure {
  header: HeaderBlock;
  primaryAnchor: ContentBlock;
  body: ContentBlock[];
  image?: ImagePlan;
  ctas: CTA[];
  footer?: ContentBlock[];
}

// ---------------------------------------------------------------------------
// Image plan
// ---------------------------------------------------------------------------

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ImageModule {
  title: string;
  key_points: string[];
}

export interface ImageAssetVariant {
  usage: "mobile" | "desktop" | "universal";
  aspectRatio: string;
  minReadableTextSizePx?: number;
  containsCriticalText: boolean;
  cropSafe: boolean;
}

export interface ImagePlan {
  role: ImageRole;
  aspect_ratio: string;
  safe_text_zones: Rect[];
  hero_title: string;
  hero_subtitle?: string;
  modules: ImageModule[];
  /** Critical facts that MUST also live in native card text/CTA. */
  critical_facts_repeated_in_card: string[];
  prompt: string;
  negative_prompt?: string;
  variants: ImageAssetVariant[];
  /** Mobile readability verdict (filled by mobile image pass). */
  mobile_readable_without_zoom?: boolean;
  /** Text-to-image fallback: render Chinese natively instead of baking it. */
  native_text_fallback: boolean;
}

// ---------------------------------------------------------------------------
// CTA / Interaction
// ---------------------------------------------------------------------------

export interface LinkTarget {
  universal?: string;
  pc?: string;
  ios?: string;
  android?: string;
}

export interface CTA {
  id: string;
  label: string; // verb + object
  type: "url" | "callback";
  url?: string;
  linkTarget?: LinkTarget;
  callbackKey?: string;
  priority: "primary" | "secondary";
  sourceFactId?: string;
  /** Which image module this CTA maps to (navigation mapping). */
  mapsToImageModule?: string;
}

// ---------------------------------------------------------------------------
// Device profile & mobile layout
// ---------------------------------------------------------------------------

export interface DeviceProfile {
  primarySurface: "mobile";
  targets: Array<"ios" | "android" | "desktop">;
  mobileFirst: true;
  allowHorizontalScroll: false;
  preferredColumns: 1;
  maxTextColumns: 2;
  preferredPrimaryCTA: "full_width";
}

export interface MobileLayoutPlan {
  mobile_first: true;
  readingOrder: string[];
  columnStrategy: "single" | "limited_two_column";
  primaryAnchorPosition: "top";
  primaryCTAPlacement: "early" | "after_primary_content";
  secondaryCTAStyle: "stacked" | "two_column";
  maxSecondaryCTAPerRow: 1 | 2;
  imageMode: "hero" | "information" | "none";
  imageReadableWithoutZoom: boolean;
  criticalFactsAboveFold: string[];
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Style profile
// ---------------------------------------------------------------------------

export interface StyleColorSystem {
  primaryBrand: string;
  primaryText: string;
  secondaryText: string;
  mutedText: string;
  surface: string;
  elevatedSurface: string;
  accent: string;
  success: string;
  warning: string;
  danger: string;
  divider: string;
}

export interface StyleProfile {
  slug: string;
  brandIdentity: string;
  keywords: string[];
  visualDirection: string;
  emotionalTone: string;
  colors: StyleColorSystem;
  gradient: string;
  /** Feishu header template color token (blue/turquoise/wathet/...). */
  feishuHeaderTemplate: string;
  isBrandResolved: boolean;
  /** Full style.md content string. */
  markdown: string;
}

// ---------------------------------------------------------------------------
// QA
// ---------------------------------------------------------------------------

export interface QAIssue {
  code: string;
  severity: "hard_fail" | "error" | "warning";
  message: string;
  stage: string;
}

export interface QACheck {
  name: string;
  pass: boolean;
  issues: QAIssue[];
}

export interface QAScore {
  informationClarity: number; // /30
  attentionHierarchy: number; // /20
  actionClarity: number; // /15
  brandConsistency: number; // /15
  visualQuality: number; // /10
  feishuNativeExperience: number; // /10
  total: number; // /100
}

export interface QAReport {
  checks: QACheck[];
  score: QAScore;
  pass: boolean;
  hardFail: boolean;
  issues: QAIssue[];
  rewrites: number;
}

export interface DeviceQA {
  pass: boolean;
  issues: string[];
}

export interface CrossDeviceQAResult {
  mobile: DeviceQA;
  ios: DeviceQA;
  android: DeviceQA;
  desktop: DeviceQA;
  overallPass: boolean;
}

// ---------------------------------------------------------------------------
// Operation copy
// ---------------------------------------------------------------------------

export interface OperationCopy {
  beforeSend: string;
  onSend: string;
  afterSend: string;
  deadlineReminder: string;
}

// ---------------------------------------------------------------------------
// Fallback layer (兜底层) — preflight守门 + 异常可控
// ---------------------------------------------------------------------------

/** A question the Skill must ask before it can safely proceed. */
export interface Clarification {
  field: string; // e.g. "submission_url" | "chat_id" | "activity_name"
  question: string; // human-facing 追问
  reason: string; // why it is needed
  blocking: boolean; // true => cannot produce a usable card without it
}

/** A low-confidence / uncertain signal surfaced to the caller. */
export interface LowConfidenceFlag {
  field: string;
  value?: string;
  confidence?: number;
  note: string;
}

/** Boundary decision: is this input actually a card-generation task? */
export interface BoundaryDecision {
  inScope: boolean;
  reason: string;
  /** When out of scope, the neighboring Skill this should be routed to. */
  suggestedSkill?: string;
}

/** A risk that requires explicit human confirmation before an action. */
export interface RiskConfirmation {
  action: string; // e.g. "send_card"
  message: string;
  requiresConfirmation: boolean;
}

export type PreflightStatus = "ok" | "needs_clarification" | "out_of_scope";

export interface PreflightResult {
  status: PreflightStatus;
  boundary: BoundaryDecision;
  clarifications: Clarification[];
  lowConfidence: LowConfidenceFlag[];
  risks: RiskConfirmation[];
  /** Degradations applied (e.g. image_led -> text_first). */
  degradations: string[];
  /** True when generation may proceed (may still carry non-blocking追问). */
  proceed: boolean;
}

// ---------------------------------------------------------------------------
// Feishu publish status
// ---------------------------------------------------------------------------

export type PublishStatus = "Generated" | "Configured" | "Tested";

// ---------------------------------------------------------------------------
// Final compile result
// ---------------------------------------------------------------------------

export interface CompileResult {
  slug: string;
  sourceOfTruth: SourceOfTruth;
  intent: CardIntentResult;
  renderMode: RenderModeResult;
  imageIntent: ImageIntentResult;
  attention: AttentionPlan;
  style: StyleProfile;
  imagePlan?: ImagePlan;
  ctas: CTA[];
  structure: CardStructure;
  mobileLayout: MobileLayoutPlan;
  deviceProfile: DeviceProfile;
  cardJson: any;
  cardPreview: any;
  cardContentMarkdown: string;
  renderPlan: any;
  operationCopy: OperationCopy;
  qa: QAReport;
  crossDeviceQA: CrossDeviceQAResult;
  preflight: PreflightResult;
  publishStatus: PublishStatus;
  scopeChecklist: string[];
}
