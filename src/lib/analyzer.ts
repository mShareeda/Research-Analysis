import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { sentimentSchema, type AnalysisReport } from "./schemas";

type AiProvider = "openai" | "openrouter";

const BAHRAIN_CONTEXTS = ["Sport", "Politics", "Economy", "Diplomacy", "Culture", "Tourism"] as const;

const aiBilingual = <T extends z.ZodTypeAny>(inner: T) => z.object({ en: inner, ar: inner });
const aiEvidenceItemSchema = z.object({ quote: z.string().min(1), explanation: z.string().min(1) });

// Internal schema: what the AI must return.
// Bahrain mention counts are computed from raw text separately.
const aiReportSchema = z.object({
  // Story track
  sentiment: sentimentSchema,
  confidence: z.number().min(0).max(1),
  sentimentKeywords: aiBilingual(z.array(z.string().min(1)).max(1000)),
  summary: aiBilingual(z.string().min(1)),
  classificationBasis: aiBilingual(z.string().min(1)),
  supportingEvidence: aiBilingual(z.array(aiEvidenceItemSchema).min(1).max(6)),
  keyClaims: aiBilingual(z.array(z.string().min(1)).min(1).max(8)),
  toneSignals: aiBilingual(z.array(z.string().min(1)).min(1).max(8)),
  // Bahrain track (AI-generated)
  bahrainSentiment: sentimentSchema,
  bahrainSentimentKeywords: aiBilingual(z.array(z.string().min(1)).max(1000)),
  bahrainClassificationBasis: aiBilingual(z.string().min(1)),
  bahrainContext: z.array(z.enum(BAHRAIN_CONTEXTS)).max(6),
  bahrainProminence: z.enum(["Small", "Medium", "Large"]).nullable(),
});

type AiReport = z.infer<typeof aiReportSchema>;

const systemPrompt =
  "You are a careful research analyst. Analyze articles on two separate tracks.\n\n" +
  "Track 1 — Story: Classify the overall sentiment of the article as positive, negative, or neutral based on the article as a whole.\n\n" +
  "Track 2 — Bahrain: Assess specifically how Bahrain is framed in the article. This is independent of the overall story sentiment. " +
  "For example, if the article covers a racing driver's performance at a race held in Bahrain, the Bahrain framing is neutral — Bahrain is simply the venue, not portrayed in a favourable or unfavourable light. " +
  "Only classify Bahrain as positive or negative if the article actively frames Bahrain itself in a favourable or unfavourable way. " +
  "Ground every assessment in the text. Do not invent facts. " +
  "Every narrative/text field must be produced in BOTH English and Arabic — write each as an object with \"en\" and \"ar\" keys holding independent, natural, fluent text in that language (not a machine-literal translation of each other, but faithful to the same meaning and grounded in the same evidence). " +
  "This also applies to supportingEvidence quotes: translate each quoted excerpt into the other language, and keep it verbatim (unchanged) in whichever language already matches the source article's language.";

const jsonInstruction =
  "Return only valid JSON matching this shape: sentiment, confidence, sentimentKeywords, summary, classificationBasis, supportingEvidence, keyClaims, toneSignals, bahrainSentiment, bahrainSentimentKeywords, bahrainClassificationBasis, bahrainContext, bahrainProminence. " +
  "confidence must be a decimal from 0 to 1, not a percentage. " +
  "sentiment and bahrainSentiment are single string values (positive/negative/neutral) — not bilingual. " +
  "Every other narrative field below must be a bilingual object shaped like {\"en\": <English version>, \"ar\": <Arabic version>} — never a bare string or array. " +
  "sentimentKeywords: {en, ar}, each 3-8 keywords or phrases (in that language) that drove the overall story sentiment rating. " +
  "summary and classificationBasis: {en, ar} strings. " +
  "supportingEvidence: {en: [...], ar: [...]}, each an array of {quote, explanation} objects. " +
  "The {en, ar} bilingual split happens ONLY at the top level of supportingEvidence — quote and explanation themselves must always be plain strings, never another {en, ar} object. " +
  "In the en array, quote/explanation are in English; in the ar array, quote/explanation are in Arabic. quote is the article's excerpt verbatim in whichever language already matches the source, and a faithful translation of that same excerpt in the other array. " +
  "keyClaims and toneSignals: {en, ar}, each an array of strings in that language. " +
  "bahrainSentimentKeywords: {en, ar}, each 3-8 keywords or phrases relating specifically to how Bahrain is portrayed, not the story overall. " +
  "bahrainClassificationBasis: {en, ar}, one or two sentences explaining why Bahrain is framed that way, grounded in the text. " +
  "bahrainContext: array of zero or more values from this list only: Sport, Politics, Economy, Diplomacy, Culture, Tourism. Always use English for these values (not bilingual). " +
  "bahrainProminence: Small (Bahrain briefly mentioned), Medium (Bahrain is a significant part of the story), Large (Bahrain is the main subject), or null.";

export function getAnalysisProvider(): AiProvider {
  return process.env.AI_PROVIDER === "openai" ? "openai" : "openrouter";
}

export function getAnalysisModel() {
  if (getAnalysisProvider() === "openrouter") {
    return process.env.OPENROUTER_MODEL ?? "openrouter/auto";
  }
  return process.env.OPENAI_MODEL ?? "gpt-4.1-mini";
}

// Matches "Bahrain" (English) plus common localized spellings:
// Spanish "Baréin"/"Bahréin", Italian "Bahrein", and Arabic "البحرين".
const BAHRAIN_PATTERNS = [/bahrain/gi, /bah?r[eé]in/gi, /البحرين/g];

function countMentions(text: string) {
  return BAHRAIN_PATTERNS.reduce((sum, pattern) => sum + (text.match(pattern) ?? []).length, 0);
}

export function countBahrainMentions(title: string | null | undefined, body: string) {
  const headerCount = countMentions(title ?? "");
  const bodyCount = countMentions(body);
  return { headerCount, bodyCount };
}

export async function analyzeSource(input: {
  title?: string | null;
  text: string;
  language: string;
  sourceLabel: string;
}): Promise<AnalysisReport> {
  const aiReport =
    getAnalysisProvider() === "openrouter"
      ? await analyzeWithOpenRouter(input)
      : await analyzeWithOpenAI(input);

  const { headerCount, bodyCount } = countBahrainMentions(input.title, input.text);

  return {
    ...aiReport,
    bahrainHeaderMentions: headerCount,
    bahrainBodyMentions: bodyCount,
  };
}

async function analyzeWithOpenAI(input: {
  title?: string | null;
  text: string;
  language: string;
  sourceLabel: string;
}): Promise<AiReport> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const response = await openai.responses.parse({
    model: getAnalysisModel(),
    input: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: [
          `Source: ${input.sourceLabel}`,
          `Title: ${input.title ?? "Untitled"}`,
          `Detected language: ${input.language}`,
          "Analyze the following story or document.",
          input.text,
        ].join("\n\n"),
      },
    ],
    text: { format: zodTextFormat(aiReportSchema, "research_analysis_report") },
  });

  if (!response.output_parsed) {
    throw new Error("OpenAI did not return a valid structured analysis.");
  }

  return response.output_parsed;
}

async function analyzeWithOpenRouter(input: {
  title?: string | null;
  text: string;
  language: string;
  sourceLabel: string;
}): Promise<AiReport> {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error("OPENROUTER_API_KEY is not configured.");
  }

  const openrouter = new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: process.env.OPENROUTER_API_KEY,
    defaultHeaders: {
      "HTTP-Referer": process.env.OPENROUTER_SITE_URL ?? "http://localhost:3000",
      "X-OpenRouter-Title": process.env.OPENROUTER_APP_NAME ?? "Research Analysis",
    },
  });

  const completion = await openrouter.chat.completions.create({
    model: getAnalysisModel(),
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: `${systemPrompt}\n\n${jsonInstruction}` },
      {
        role: "user",
        content: [
          `Source: ${input.sourceLabel}`,
          `Title: ${input.title ?? "Untitled"}`,
          `Detected language: ${input.language}`,
          "Analyze the following story or document.",
          input.text,
        ].join("\n\n"),
      },
    ],
  });

  const content = completion.choices[0]?.message.content;
  if (typeof content !== "string" || content.trim().length === 0) {
    throw new Error("OpenRouter did not return an analysis.");
  }

  return aiReportSchema.parse(normalizeReportJson(JSON.parse(extractJson(content))));
}

export function normalizeReportJson(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;

  const report = { ...value } as Record<string, unknown>;

  // Confidence normalization
  if (typeof report.confidence === "number" && report.confidence > 1) {
    report.confidence = Math.min(report.confidence / 100, 1);
  }
  if (typeof report.confidence === "string") {
    const parsed = Number(report.confidence.replace("%", "").trim());
    if (Number.isFinite(parsed)) {
      report.confidence = parsed > 1 ? Math.min(parsed / 100, 1) : parsed;
    }
  }

  // Sentiment normalization
  if (typeof report.sentiment === "string") report.sentiment = report.sentiment.toLowerCase();
  if (typeof report.bahrainSentiment === "string") report.bahrainSentiment = report.bahrainSentiment.toLowerCase();

  // Bilingual narrative fields
  normalizeBilingualText(report, "summary");
  normalizeBilingualText(report, "classificationBasis");
  normalizeBilingualText(report, "bahrainClassificationBasis");
  normalizeBilingualStringArray(report, "sentimentKeywords", 1000);
  normalizeBilingualStringArray(report, "keyClaims", 8);
  normalizeBilingualStringArray(report, "toneSignals", 8);
  normalizeBilingualStringArray(report, "bahrainSentimentKeywords", 1000);
  normalizeBilingualEvidence(report, "supportingEvidence");

  // bahrainContext — filter to valid enum values only
  const validContexts = new Set(BAHRAIN_CONTEXTS);
  if (Array.isArray(report.bahrainContext)) {
    report.bahrainContext = [
      ...new Set(
        report.bahrainContext
          .map((c: unknown) => {
            if (typeof c !== "string") return "";
            const t = c.trim();
            if (validContexts.has(t as (typeof BAHRAIN_CONTEXTS)[number])) return t;
            const titled = t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
            return validContexts.has(titled as (typeof BAHRAIN_CONTEXTS)[number]) ? titled : "";
          })
          .filter(Boolean),
      ),
    ].slice(0, 6);
  } else {
    report.bahrainContext = [];
  }

  // bahrainProminence normalization
  if (typeof report.bahrainProminence === "string") {
    const t = report.bahrainProminence.trim();
    const titled = t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
    report.bahrainProminence = ["Small", "Medium", "Large"].includes(titled) ? titled : null;
  } else if (report.bahrainProminence !== null) {
    report.bahrainProminence = null;
  }

  return report;
}

function trimArray(report: Record<string, unknown>, key: string, max: number) {
  if (Array.isArray(report[key]) && (report[key] as unknown[]).length > max) {
    report[key] = (report[key] as unknown[]).slice(0, max);
  }
}

function normalizeStringArray(report: Record<string, unknown>, key: string, max: number) {
  if (typeof report[key] === "string") {
    report[key] = report[key] ? [report[key]] : [];
  }
  if (!Array.isArray(report[key])) return;
  report[key] = (report[key] as unknown[])
    .slice(0, max)
    .map((item) => {
      if (typeof item === "string") return item;
      if (typeof item === "number" || typeof item === "boolean") return String(item);
      if (item && typeof item === "object") return objectToReadableString(item as Record<string, unknown>);
      return "";
    })
    .filter((item) => item.trim().length > 0);
}

function isBilingualObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

// A bilingual text field must be {en, ar}. If the model ignored that and returned a
// bare string instead, duplicate it into both languages rather than failing validation.
function normalizeBilingualText(report: Record<string, unknown>, key: string) {
  const raw = report[key];
  if (isBilingualObject(raw)) {
    report[key] = {
      en: typeof raw.en === "string" ? raw.en : "",
      ar: typeof raw.ar === "string" ? raw.ar : "",
    };
  } else if (typeof raw === "string") {
    report[key] = { en: raw, ar: raw };
  }
}

// If the model over-applied the bilingual instruction and nested {en, ar} inside an
// individual array item too, pick this side's language out of it before generic
// string coercion runs (otherwise the wrong language could leak into either side).
function unnestBilingualArrayItem(item: unknown, lang: "en" | "ar"): unknown {
  if (isBilingualObject(item) && ("en" in item || "ar" in item)) {
    return item[lang] ?? item.en ?? item.ar;
  }
  return item;
}

function normalizeBilingualStringArray(report: Record<string, unknown>, key: string, max: number) {
  const raw = report[key];
  if (isBilingualObject(raw)) {
    const enItems = Array.isArray(raw.en) ? raw.en.map((item) => unnestBilingualArrayItem(item, "en")) : raw.en;
    const arItems = Array.isArray(raw.ar) ? raw.ar.map((item) => unnestBilingualArrayItem(item, "ar")) : raw.ar;
    const en = { [key]: enItems };
    normalizeStringArray(en, key, max);
    const ar = { [key]: arItems };
    normalizeStringArray(ar, key, max);
    report[key] = { en: en[key] ?? [], ar: ar[key] ?? [] };
  } else if (Array.isArray(raw) || typeof raw === "string") {
    const wrapper = { [key]: raw };
    normalizeStringArray(wrapper, key, max);
    report[key] = { en: wrapper[key] ?? [], ar: wrapper[key] ?? [] };
  }
}

// A quote/explanation value should be a plain string. If the model over-applied the
// bilingual instruction and nested {en, ar} here too, pick this side's language out of it.
function stringifyEvidenceField(value: unknown, lang: "en" | "ar"): string {
  if (typeof value === "string") return value;
  if (isBilingualObject(value)) {
    const picked = value[lang] ?? value.en ?? value.ar;
    if (typeof picked === "string") return picked;
    return objectToReadableString(value);
  }
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

function normalizeEvidenceSide(side: unknown, lang: "en" | "ar") {
  if (!Array.isArray(side)) return [];
  const wrapper = { side };
  trimArray(wrapper, "side", 6);
  return (wrapper.side as unknown[])
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const obj = item as Record<string, unknown>;
      const quote = stringifyEvidenceField(obj.quote, lang);
      const explanation = stringifyEvidenceField(obj.explanation, lang);
      if (!quote.trim() || !explanation.trim()) return null;
      return { quote, explanation };
    })
    .filter((item): item is { quote: string; explanation: string } => item !== null);
}

function normalizeBilingualEvidence(report: Record<string, unknown>, key: string) {
  const raw = report[key];
  if (isBilingualObject(raw)) {
    report[key] = { en: normalizeEvidenceSide(raw.en, "en"), ar: normalizeEvidenceSide(raw.ar, "ar") };
  } else if (Array.isArray(raw)) {
    report[key] = { en: normalizeEvidenceSide(raw, "en"), ar: normalizeEvidenceSide(raw, "ar") };
  }
}

function objectToReadableString(item: Record<string, unknown>) {
  const preferredKeys = [
    "signal", "tone", "claim", "question", "limitation",
    "description", "explanation", "text", "keyword",
  ];
  for (const key of preferredKeys) {
    const value = item[key];
    if (typeof value === "string" && value.trim().length > 0) return value.trim();
  }
  return Object.entries(item)
    .map(([k, v]) =>
      typeof v === "string" || typeof v === "number" || typeof v === "boolean" ? `${k}: ${v}` : "",
    )
    .filter(Boolean)
    .join("; ");
}

export function extractJson(content: string) {
  const trimmed = content.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) return trimmed;
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) return fenced[1].trim();
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) return trimmed.slice(firstBrace, lastBrace + 1);
  const preview = trimmed.slice(0, 200);
  throw new Error(`OpenRouter did not return valid JSON. Response preview: "${preview}"`);
}
