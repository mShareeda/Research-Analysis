import { z } from "zod";

// Controlled vocabularies straight out of Analysis_Guide.md.

export const SITE_OPTIONS = ["ESPN", "Fox Sports", "Gazzetta", "Marca", "Sky Sports", "Other"] as const;
export const ARTICLE_TYPE_OPTIONS = ["News", "Report", "Analysis", "Opinion"] as const;
// "Life Cycle" is this app's simplified label/values for the guide's "Coverage Stage"
// field (originally "One week before/during/after the race").
export const LIFE_CYCLE_OPTIONS = ["Before", "During", "After"] as const;
export const CENTRALITY_OPTIONS = ["Peripheral", "Moderate", "Central"] as const;
export const TONE_OPTIONS = ["Positive", "Negative", "Neutral"] as const;
export const CONTEXT_OPTIONS = [
  "Sports",
  "Economic",
  "Tourism",
  "Political",
  "Organizational",
  "Security",
  "Human Rights",
  "Cultural",
  "Technical",
  "Mixed",
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
  "Other",
] as const;
export const IMAGE_OPTIONS = [
  "Well Organized",
  "Modern",
  "International",
  "Stable",
  "Hospitable",
  "Attractive Destination",
  "Developed",
  "Controversial",
  "Other",
] as const;

const bilingualText = z.object({ en: z.string(), ar: z.string() });

// What the AI must return. Article info that can be read straight off the page
// (title/url/date), and Bahrain mention counts, are computed separately — not asked of the AI.
// Every coded value here is final AI output — the app does not let users edit it after
// the fact, so the coding stays a consistent, unedited record of the model's judgment.
export const codingAiSchema = z.object({
  site: z.enum(SITE_OPTIONS),
  siteOther: z.string().optional(),
  articleType: z.enum(ARTICLE_TYPE_OPTIONS),
  lifeCycle: z.enum(LIFE_CYCLE_OPTIONS),
  bahrainCentrality: z.enum(CENTRALITY_OPTIONS),
  overallTone: z.enum(TONE_OPTIONS),
  toneTowardBahrain: z.enum(TONE_OPTIONS),
  dominantContext: z.enum(CONTEXT_OPTIONS),
  dominantNewsFrame: z.enum(NEWS_FRAME_OPTIONS),
  newsFrameOther: z.string().optional(),
  dominantImage: z.enum(IMAGE_OPTIONS),
  imageOther: z.string().optional(),
  notes: bilingualText.optional(),
});

export type CodingAiReport = z.infer<typeof codingAiSchema>;

// The full record as stored/returned by the app — AI fields plus the
// computed/extracted fields (article info + Bahrain mention counts).
export const codedArticleSchema = codingAiSchema.extend({
  id: z.string(),
  url: z.string().nullable(),
  articleTitle: z.string(),
  publicationDate: z.string().nullable(),
  year: z.number().int().nullable(),
  bahrainInTitle: z.boolean(),
  headlineMentions: z.number().int(),
  bodyMentions: z.number().int(),
  model: z.string(),
  createdAt: z.string(),
});

export type CodedArticle = z.infer<typeof codedArticleSchema>;
