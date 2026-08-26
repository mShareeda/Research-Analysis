import { z } from "zod";

export const sentimentSchema = z.enum(["positive", "negative", "neutral"]);

export const bahrainContextSchema = z.enum([
  "Sport",
  "Politics",
  "Economy",
  "Diplomacy",
  "Culture",
  "Tourism",
]);

const evidenceItemSchema = z.object({ quote: z.string().min(1), explanation: z.string().min(1) });

const bilingual = <T extends z.ZodTypeAny>(inner: T) => z.object({ en: inner, ar: inner });

export const analysisReportSchema = z.object({
  // --- Story track ---
  sentiment: sentimentSchema.describe("Overall sentiment of the article as a whole."),
  confidence: z.number().min(0).max(1),
  sentimentKeywords: bilingual(z.array(z.string().min(1)).max(1000)).optional(),
  summary: bilingual(z.string().min(1)),
  classificationBasis: bilingual(z.string().min(1)),
  supportingEvidence: bilingual(z.array(evidenceItemSchema).min(1).max(6)),
  keyClaims: bilingual(z.array(z.string().min(1)).min(1).max(8)),
  toneSignals: bilingual(z.array(z.string().min(1)).min(1).max(8)),
  // --- Bahrain track ---
  bahrainHeaderMentions: z.number().int().min(0).optional(),
  bahrainBodyMentions: z.number().int().min(0).optional(),
  bahrainContext: z.array(bahrainContextSchema).max(6).optional(),
  bahrainProminence: z.enum(["Small", "Medium", "Large"]).nullable().optional(),
  bahrainSentiment: sentimentSchema.optional(),
  bahrainSentimentKeywords: bilingual(z.array(z.string().min(1)).max(1000)).optional(),
  bahrainClassificationBasis: bilingual(z.string().min(1)).optional(),
});

export type AnalysisReport = z.infer<typeof analysisReportSchema>;

// The single-language shape every report resolves to for display — same shape
// this app used before bilingual support existed.
export type FlatAnalysisReport = {
  sentiment: z.infer<typeof sentimentSchema>;
  confidence: number;
  sentimentKeywords?: string[];
  summary: string;
  classificationBasis: string;
  supportingEvidence: Array<{ quote: string; explanation: string }>;
  keyClaims: string[];
  toneSignals: string[];
  bahrainHeaderMentions?: number;
  bahrainBodyMentions?: number;
  bahrainContext?: Array<z.infer<typeof bahrainContextSchema>>;
  bahrainProminence?: "Small" | "Medium" | "Large" | null;
  bahrainSentiment?: z.infer<typeof sentimentSchema>;
  bahrainSentimentKeywords?: string[];
  bahrainClassificationBasis?: string;
};

export type ViewLang = "en" | "ar";

function isBilingualValue(value: unknown): value is { en: unknown; ar: unknown } {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value) && ("en" in (value as object) || "ar" in (value as object));
}

// Resolves a bilingual field ({en, ar}) down to one language. Legacy (pre-bilingual)
// reports stored a flat value directly — those pass through unchanged for either language.
function pick<T>(value: T | { en: T; ar: T } | undefined, lang: ViewLang): T | undefined {
  if (value === undefined) return undefined;
  if (isBilingualValue(value)) return (value[lang] ?? value.en) as T;
  return value as T;
}

// True only for reports that actually carry both languages (i.e. analyzed after this
// feature shipped) — used to decide whether to show the language tab at all.
export function isBilingualReport(report: AnalysisReport): boolean {
  return isBilingualValue(report.summary);
}

export function resolveReportLanguage(report: AnalysisReport, lang: ViewLang): FlatAnalysisReport {
  return {
    sentiment: report.sentiment,
    confidence: report.confidence,
    sentimentKeywords: pick(report.sentimentKeywords, lang),
    summary: pick(report.summary, lang) as string,
    classificationBasis: pick(report.classificationBasis, lang) as string,
    supportingEvidence: pick(report.supportingEvidence, lang) as Array<{ quote: string; explanation: string }>,
    keyClaims: pick(report.keyClaims, lang) as string[],
    toneSignals: pick(report.toneSignals, lang) as string[],
    bahrainHeaderMentions: report.bahrainHeaderMentions,
    bahrainBodyMentions: report.bahrainBodyMentions,
    bahrainContext: report.bahrainContext,
    bahrainProminence: report.bahrainProminence,
    bahrainSentiment: report.bahrainSentiment,
    bahrainSentimentKeywords: pick(report.bahrainSentimentKeywords, lang),
    bahrainClassificationBasis: pick(report.bahrainClassificationBasis, lang),
  };
}

export type AnalyzeResponse = {
  id: string;
  sourceId: string;
  report: AnalysisReport;
  duplicate?: boolean;
  analyzedAt?: string;
};
