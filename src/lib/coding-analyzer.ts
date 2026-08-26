import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { getAnalysisModel, getAnalysisProvider, extractJson } from "./analyzer";
import {
  ARTICLE_TYPE_OPTIONS,
  CENTRALITY_OPTIONS,
  CENTRAL_ACTOR_OPTIONS,
  CONTEXT_OPTIONS,
  LIFE_CYCLE_OPTIONS,
  IMAGE_OPTIONS,
  NEWS_FRAME_OPTIONS,
  OVERALL_TONE_OPTIONS,
  BAHRAIN_TONE_OPTIONS,
  codingAiSchema,
  type CodingAiReport,
} from "./coding-schemas";

// Official Bahrain International Circuit F1 Grand Prix race-weekend dates.
// Used to deterministically classify Life Cycle from an article's publication
// date rather than leaving date arithmetic to the AI. Best-effort — double-check
// against the official F1 calendar if a classification looks wrong.
const RACE_WEEKENDS: Record<number, { start: string; end: string }> = {
  2021: { start: "2021-03-26", end: "2021-03-28" },
  2022: { start: "2022-03-18", end: "2022-03-20" },
  2023: { start: "2023-03-03", end: "2023-03-05" },
  2024: { start: "2024-02-29", end: "2024-03-02" },
  2025: { start: "2025-04-11", end: "2025-04-13" },
};

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export function classifyLifeCycle(publishedAt: Date | undefined | null): "Before" | "During" | "After" | undefined {
  if (!publishedAt || isNaN(publishedAt.getTime())) return undefined;
  const weekend = RACE_WEEKENDS[publishedAt.getFullYear()];
  if (!weekend) return undefined;

  const start = new Date(weekend.start);
  const end = new Date(`${weekend.end}T23:59:59`);

  if (publishedAt >= start && publishedAt <= end) return "During";
  if (publishedAt < start && publishedAt.getTime() >= start.getTime() - ONE_WEEK_MS) {
    return "Before";
  }
  if (publishedAt > end && publishedAt.getTime() <= end.getTime() + ONE_WEEK_MS) {
    return "After";
  }
  return undefined;
}

const systemPrompt =
  "You are an academic content analyst coding one news article at a time for a study titled " +
  '"أطر المعالجة الإخبارية لجائزة البحرين الكبرى للفورمولا 1 في المواقع الإخبارية الرياضية العالمية وتمثيلاتها للصورة الذهنية عن المملكة" ' +
  '("News Framing of the Bahrain Formula 1 Grand Prix in International Sports News Websites and Its Representations of the Kingdom\'s Image").\n\n' +
  "Base every coding decision strictly on the article itself — the headline and body together are the context unit. Do not infer or assume anything not explicitly stated. This output will be reviewed and can be edited by a human coder before it is final, so prefer your best single judgment per field rather than hedging.\n\n" +
  "Field definitions:\n" +
  `- articleType: ${ARTICLE_TYPE_OPTIONS.slice(0, -1).join(" / ")} — the journalistic form of the piece. If none fit, use "Other" and specify in articleTypeOther.\n` +
  `- lifeCycle: ${LIFE_CYCLE_OPTIONS.join(" / ")} — whether the article was published before, during, or after the Bahrain race weekend, based on textual cues if the date is ambiguous.\n` +
  "- bahrainCentrality: Peripheral (Bahrain is mentioned only as the race location), Moderate (Bahrain appears in several parts with some elaboration but is not the main focus), or Central (Bahrain is a primary/central subject of the article).\n" +
  "- overallTone: the tone of the entire article — Positive, Negative, or Neutral.\n" +
  '- toneTowardBahrain: evaluate only how Bahrain itself is portrayed — not the race, teams, or drivers. Use "NotApplicable" when Bahrain is not actually portrayed/characterized at all (e.g. mentioned only in passing as a place name). A race report that is upbeat about a driver\'s win but treats Bahrain as a neutral venue should score toneTowardBahrain as Neutral even if overallTone is Positive.\n' +
  `- dominantContext: the single most dominant context Bahrain appears in — ${CONTEXT_OPTIONS.join(", ")}. Pick only the most prominent one.\n` +
  `- dominantNewsFrame: the single dominant interpretive frame of the whole article — ${NEWS_FRAME_OPTIONS.slice(0, -1).join(", ")}, or "Other" with newsFrameOther specifying it. Pick only the most prominent one.\n` +
  `- centralActor: the single most prominent actor/entity in the article — ${CENTRAL_ACTOR_OPTIONS.slice(0, -1).join(", ")}, or "Other" with centralActorOther specifying it.\n` +
  `- dominantImage: the strongest mental image/attribute of Bahrain conveyed — ${IMAGE_OPTIONS.slice(0, -2).join(", ")}, "Other" with imageOther specifying it, or "NotApplicable" if Bahrain has no discernible image in this article.\n` +
  "- textExamples: one or two short quotes or paraphrased lines from the article (in the article's own language) that best support your coding decisions, especially overallTone and toneTowardBahrain. Omit if nothing suitable.\n" +
  "- notes: brief additional observations, in Arabic, that may help a human reviewer double-check or resolve an ambiguous coding decision. Omit if there is nothing to add.";

const jsonInstruction =
  "Return only valid JSON with exactly these keys: articleType, articleTypeOther, lifeCycle, bahrainCentrality, overallTone, toneTowardBahrain, dominantContext, dominantNewsFrame, newsFrameOther, centralActor, centralActorOther, dominantImage, imageOther, textExamples, notes. " +
  "articleTypeOther/newsFrameOther/centralActorOther/imageOther/textExamples/notes are plain strings, omit or leave empty when not applicable. Every enum field must be exactly one of the listed values, verbatim, in English.";

export async function codeArticle(input: {
  title?: string | null;
  text: string;
  sourceLabel: string;
  publishedAt?: Date | null;
}): Promise<CodingAiReport> {
  return getAnalysisProvider() === "openrouter" ? codeWithOpenRouter(input) : codeWithOpenAI(input);
}

function userMessage(input: { title?: string | null; text: string; sourceLabel: string; publishedAt?: Date | null }) {
  return [
    `Source: ${input.sourceLabel}`,
    `Title: ${input.title ?? "Untitled"}`,
    input.publishedAt ? `Publication date: ${input.publishedAt.toISOString().slice(0, 10)}` : "Publication date: unknown",
    "Code the following article.",
    input.text,
  ].join("\n\n");
}

async function codeWithOpenAI(input: {
  title?: string | null;
  text: string;
  sourceLabel: string;
  publishedAt?: Date | null;
}): Promise<CodingAiReport> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const response = await openai.responses.parse({
    model: getAnalysisModel(),
    input: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage(input) },
    ],
    text: { format: zodTextFormat(codingAiSchema, "article_coding_report") },
  });

  if (!response.output_parsed) {
    throw new Error("OpenAI did not return a valid structured coding.");
  }

  return response.output_parsed;
}

async function codeWithOpenRouter(input: {
  title?: string | null;
  text: string;
  sourceLabel: string;
  publishedAt?: Date | null;
}): Promise<CodingAiReport> {
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
      { role: "user", content: userMessage(input) },
    ],
  });

  const content = completion.choices[0]?.message.content;
  if (typeof content !== "string" || content.trim().length === 0) {
    throw new Error("OpenRouter did not return a coding.");
  }

  return codingAiSchema.parse(normalizeCodingJson(JSON.parse(extractJson(content))));
}

function matchEnum<T extends string>(value: unknown, options: readonly T[], fallback: T): T {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  const exact = options.find((o) => o === trimmed);
  if (exact) return exact;
  const caseInsensitive = options.find((o) => o.toLowerCase() === trimmed.toLowerCase());
  return caseInsensitive ?? fallback;
}

function stringOrUndefined(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

// Coerces a messy OpenRouter response (wrong casing, missing keys) into a shape
// that will pass codingAiSchema, rather than failing the whole request over a
// minor formatting slip.
export function normalizeCodingJson(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const report = value as Record<string, unknown>;

  return {
    articleType: matchEnum(report.articleType, ARTICLE_TYPE_OPTIONS, "News"),
    articleTypeOther: stringOrUndefined(report.articleTypeOther),
    lifeCycle: matchEnum(report.lifeCycle, LIFE_CYCLE_OPTIONS, "During"),
    bahrainCentrality: matchEnum(report.bahrainCentrality, CENTRALITY_OPTIONS, "Moderate"),
    overallTone: matchEnum(report.overallTone, OVERALL_TONE_OPTIONS, "Neutral"),
    toneTowardBahrain: matchEnum(report.toneTowardBahrain, BAHRAIN_TONE_OPTIONS, "Neutral"),
    dominantContext: matchEnum(report.dominantContext, CONTEXT_OPTIONS, "Mixed"),
    dominantNewsFrame: matchEnum(report.dominantNewsFrame, NEWS_FRAME_OPTIONS, "Other"),
    newsFrameOther: stringOrUndefined(report.newsFrameOther),
    centralActor: matchEnum(report.centralActor, CENTRAL_ACTOR_OPTIONS, "Other"),
    centralActorOther: stringOrUndefined(report.centralActorOther),
    dominantImage: matchEnum(report.dominantImage, IMAGE_OPTIONS, "Other"),
    imageOther: stringOrUndefined(report.imageOther),
    textExamples: stringOrUndefined(report.textExamples),
    notes: stringOrUndefined(report.notes),
  };
}
