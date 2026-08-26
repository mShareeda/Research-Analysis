import type { CodedArticle as CodedArticleRow } from "@prisma/client";
import { countBahrainMentions, getAnalysisModel } from "./analyzer";
import { classifyLifeCycle, codeArticle } from "./coding-analyzer";
import { prisma } from "./prisma";
import { SITE_OPTIONS } from "./coding-schemas";
import type { CodingDraft } from "./coding-schemas";

const SITE_HOSTNAME_PATTERNS: Array<{ pattern: RegExp; site: (typeof SITE_OPTIONS)[number] }> = [
  { pattern: /(^|\.)espn\./i, site: "ESPN" },
  { pattern: /(^|\.)skysports\./i, site: "Sky Sports" },
  { pattern: /(^|\.)marca\./i, site: "Marca" },
  { pattern: /(^|\.)gazzetta\./i, site: "La Gazzetta dello Sport" },
  { pattern: /(^|\.)foxsports\./i, site: "Fox Sports" },
];

// Deterministic — not left to the AI — since the form's site list is a fixed, closed set.
// Returns null when the URL doesn't match any of the study's five outlets (e.g. pasted
// text with no URL), and the coder picks it manually in the review step.
export function detectSiteFromUrl(url: string | null | undefined): (typeof SITE_OPTIONS)[number] | null {
  if (!url) return null;
  try {
    const hostname = new URL(url).hostname;
    return SITE_HOSTNAME_PATTERNS.find(({ pattern }) => pattern.test(hostname))?.site ?? null;
  } catch {
    return null;
  }
}

// Builds an AI-coded draft for one article. Nothing is persisted here — the coder
// reviews/edits the returned draft, then POSTs it to /api/coding to save it for real.
export async function buildCodingDraft(input: {
  sourceType: "URL" | "PASTE";
  url?: string | null;
  articleTitle: string;
  extractedText: string;
  site: (typeof SITE_OPTIONS)[number] | null;
  coderName: string;
  // Publication Date and Year are user-entered — never auto-extracted from the article.
  publicationDate?: string;
  year?: number;
}): Promise<CodingDraft> {
  const { headerCount, bodyCount } = countBahrainMentions(input.articleTitle, input.extractedText);
  const publicationDate = input.publicationDate ? new Date(input.publicationDate) : undefined;
  const year = input.year ?? (publicationDate && !isNaN(publicationDate.getTime()) ? publicationDate.getFullYear() : undefined);

  const aiReport = await codeArticle({
    title: input.articleTitle,
    text: input.extractedText,
    sourceLabel: input.url ?? input.articleTitle,
    publishedAt: publicationDate,
  });

  const lifeCycle = classifyLifeCycle(publicationDate) ?? aiReport.lifeCycle;

  return {
    ...aiReport,
    site: input.site,
    articleTitle: input.articleTitle,
    url: input.url ?? null,
    sourceType: input.sourceType,
    extractedText: input.extractedText,
    publicationDate: publicationDate && !isNaN(publicationDate.getTime()) ? publicationDate.toISOString() : null,
    year: year ?? null,
    bahrainInTitle: headerCount > 0,
    bahrainInBody: bodyCount > 0,
    headlineMentions: headerCount,
    bodyMentions: bodyCount,
    totalMentions: headerCount + bodyCount,
    lifeCycle,
    coderName: input.coderName,
    codingDate: new Date().toISOString().slice(0, 10),
    model: getAnalysisModel(),
  };
}

// Persists a (possibly coder-edited) draft as the final, immutable record.
export async function saveCodedArticle(draft: CodingDraft) {
  const site = draft.site;
  if (!site) {
    throw new Error("Select a news website before saving.");
  }
  if (!draft.coderName.trim()) {
    throw new Error("Coder name is required before saving.");
  }

  const publicationDate = draft.publicationDate ? new Date(draft.publicationDate) : undefined;
  const codingDate = new Date(draft.codingDate);

  return prisma.$transaction(async (tx) => {
    const count = await tx.codedArticle.count();
    return tx.codedArticle.create({
      data: {
        articleNumber: count + 1,
        coderName: draft.coderName,
        codingDate: !isNaN(codingDate.getTime()) ? codingDate : new Date(),
        sourceType: draft.sourceType,
        url: draft.url,
        articleTitle: draft.articleTitle,
        extractedText: draft.extractedText,
        site,
        publicationDate,
        year: draft.year ?? undefined,
        lifeCycle: draft.lifeCycle,
        articleType: draft.articleType,
        articleTypeOther: draft.articleTypeOther,
        bahrainInTitle: draft.bahrainInTitle,
        bahrainInBody: draft.bahrainInBody,
        headlineMentions: draft.headlineMentions,
        bodyMentions: draft.bodyMentions,
        totalMentions: draft.totalMentions,
        bahrainCentrality: draft.bahrainCentrality,
        overallTone: draft.overallTone,
        toneTowardBahrain: draft.toneTowardBahrain,
        dominantContext: draft.dominantContext,
        dominantNewsFrame: draft.dominantNewsFrame,
        newsFrameOther: draft.newsFrameOther,
        centralActor: draft.centralActor,
        centralActorOther: draft.centralActorOther,
        dominantImage: draft.dominantImage,
        imageOther: draft.imageOther,
        textExamples: draft.textExamples,
        notesAr: draft.notes,
        model: draft.model,
      },
    });
  });
}

// Shapes a Prisma row into the plain-JSON form the API/UI work with (dates as ISO strings).
export function serializeCodedArticle(row: CodedArticleRow) {
  return {
    id: row.id,
    articleNumber: row.articleNumber,
    coderName: row.coderName,
    codingDate: row.codingDate.toISOString().slice(0, 10),
    sourceType: row.sourceType,
    url: row.url,
    articleTitle: row.articleTitle,
    extractedText: row.extractedText,
    site: row.site,
    publicationDate: row.publicationDate ? row.publicationDate.toISOString() : null,
    year: row.year,
    lifeCycle: row.lifeCycle,
    articleType: row.articleType,
    articleTypeOther: row.articleTypeOther,
    bahrainInTitle: row.bahrainInTitle,
    bahrainInBody: row.bahrainInBody,
    headlineMentions: row.headlineMentions,
    bodyMentions: row.bodyMentions,
    totalMentions: row.totalMentions,
    bahrainCentrality: row.bahrainCentrality,
    overallTone: row.overallTone,
    toneTowardBahrain: row.toneTowardBahrain,
    dominantContext: row.dominantContext,
    dominantNewsFrame: row.dominantNewsFrame,
    newsFrameOther: row.newsFrameOther,
    centralActor: row.centralActor,
    centralActorOther: row.centralActorOther,
    dominantImage: row.dominantImage,
    imageOther: row.imageOther,
    textExamples: row.textExamples,
    notes: row.notesAr ?? undefined,
    model: row.model,
    createdAt: row.createdAt.toISOString(),
  };
}
