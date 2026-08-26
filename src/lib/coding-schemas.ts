import { z } from "zod";

// Controlled vocabularies straight out of "استمارة تحليل المضمون" (the study's content-analysis
// coding form). Internal values stay short English identifiers for a stable/queryable dataset;
// coding-labels.ts is the only place Arabic display text lives.

export const SITE_OPTIONS = ["ESPN", "Sky Sports", "Marca", "La Gazzetta dello Sport", "Fox Sports"] as const;
export const ARTICLE_TYPE_OPTIONS = [
  "News",
  "Report",
  "Analysis",
  "Opinion",
  "Interview",
  "Preview",
  "Review",
  "Other",
] as const;
// "Life Cycle" is this app's simplified label/values for the form's "المرحلة الزمنية للتغطية".
export const LIFE_CYCLE_OPTIONS = ["Before", "During", "After"] as const;
export const CENTRALITY_OPTIONS = ["Peripheral", "Moderate", "Central"] as const;
export const OVERALL_TONE_OPTIONS = ["Positive", "Negative", "Neutral"] as const;
export const BAHRAIN_TONE_OPTIONS = ["Positive", "Negative", "Neutral", "NotApplicable"] as const;
export const CONTEXT_OPTIONS = [
  "Sports",
  "Organizational",
  "Economic",
  "Tourism",
  "Political",
  "Security",
  "HumanRightsDisputed",
  "CulturalHeritage",
  "TechnicalLogistical",
  "Mixed",
  "NotApplicable",
] as const;
export const NEWS_FRAME_OPTIONS = [
  "Sporting Competition",
  "Organizational Success",
  "National Promotion",
  "Economic Benefits",
  "Tourism Promotion",
  "Security and Stability",
  "Controversy or Criticism",
  "International Presence",
  "Humanitarian Aspect",
  "Mixed Frame",
  "Other",
] as const;
export const CENTRAL_ACTOR_OPTIONS = [
  "Kingdom of Bahrain",
  "Formula 1",
  "Drivers",
  "Teams",
  "Organizers",
  "Audience",
  "Official or Government Bodies",
  "Sponsors or Economy",
  "Other",
] as const;
export const IMAGE_OPTIONS = [
  "Organized",
  "Modern and Advanced",
  "Global",
  "Hospitable",
  "Stable",
  "Tourism Attractive",
  "Economically Influential",
  "Controversial",
  "Marginal Presence",
  "Neutral or Descriptive",
  "Other",
  "NotApplicable",
] as const;

// What the AI must return. Article identity (site/title/url/date/year), Bahrain mention
// counts, coder name, and coding date are supplied separately — not asked of the AI.
export const codingAiSchema = z.object({
  articleType: z.enum(ARTICLE_TYPE_OPTIONS),
  articleTypeOther: z.string().optional(),
  lifeCycle: z.enum(LIFE_CYCLE_OPTIONS),
  bahrainCentrality: z.enum(CENTRALITY_OPTIONS),
  overallTone: z.enum(OVERALL_TONE_OPTIONS),
  toneTowardBahrain: z.enum(BAHRAIN_TONE_OPTIONS),
  dominantContext: z.enum(CONTEXT_OPTIONS),
  dominantNewsFrame: z.enum(NEWS_FRAME_OPTIONS),
  newsFrameOther: z.string().optional(),
  centralActor: z.enum(CENTRAL_ACTOR_OPTIONS),
  centralActorOther: z.string().optional(),
  dominantImage: z.enum(IMAGE_OPTIONS),
  imageOther: z.string().optional(),
  textExamples: z.string().optional(),
  notes: z.string().optional(),
});

export type CodingAiReport = z.infer<typeof codingAiSchema>;

// A draft is the AI's suggestion plus every field the coder can review/edit before saving.
// Nothing here is persisted until the coder submits it to POST /api/coding.
export const codingDraftSchema = codingAiSchema.extend({
  // Nullable at draft stage: URL-based site detection can fail (unrecognized host), and
  // pasted text has no URL to detect from — the coder picks it manually before saving.
  site: z.enum(SITE_OPTIONS).nullable(),
  articleTitle: z.string(),
  url: z.string().nullable(),
  sourceType: z.enum(["URL", "PASTE"]),
  extractedText: z.string(),
  publicationDate: z.string().nullable(),
  year: z.number().int().min(2021).max(2025).nullable(),
  bahrainInTitle: z.boolean(),
  bahrainInBody: z.boolean(),
  headlineMentions: z.number().int(),
  bodyMentions: z.number().int(),
  totalMentions: z.number().int(),
  coderName: z.string(),
  codingDate: z.string(),
  model: z.string(),
});

export type CodingDraft = z.infer<typeof codingDraftSchema>;

// The record as returned by the list/detail APIs — same shape as the draft, minus the
// (potentially large) full extractedText, plus server-assigned identity fields once the
// coder has confirmed and saved it. The detail endpoint adds back a truncated text preview.
export const codedArticleSchema = codingDraftSchema.omit({ extractedText: true }).extend({
  site: z.enum(SITE_OPTIONS),
  id: z.string(),
  articleNumber: z.number().int(),
  createdAt: z.string(),
});

export type CodedArticle = z.infer<typeof codedArticleSchema>;
