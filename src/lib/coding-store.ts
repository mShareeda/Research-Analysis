import type { CodedArticle as CodedArticleRow } from "@prisma/client";
import { countBahrainMentions, getAnalysisModel } from "./analyzer";
import { classifyLifeCycle } from "./coding-analyzer";
import { prisma } from "./prisma";
import type { CodingAiReport } from "./coding-schemas";

export async function saveCodedArticle(input: {
  sourceType: "URL" | "CSV";
  url?: string;
  articleTitle: string;
  extractedText: string;
  // Publication Date and Year are entered by the user — never auto-extracted
  // from the article — so both are optional and independent of each other.
  publicationDate?: string;
  year?: number;
  aiReport: CodingAiReport;
}) {
  const { headerCount, bodyCount } = countBahrainMentions(input.articleTitle, input.extractedText);
  const publicationDate = input.publicationDate ? new Date(input.publicationDate) : undefined;
  const year = input.year ?? (publicationDate && !isNaN(publicationDate.getTime()) ? publicationDate.getFullYear() : undefined);
  const lifeCycle = classifyLifeCycle(publicationDate) ?? input.aiReport.lifeCycle;

  return prisma.codedArticle.create({
    data: {
      sourceType: input.sourceType,
      url: input.url,
      articleTitle: input.articleTitle,
      extractedText: input.extractedText,
      site: input.aiReport.site,
      siteOther: input.aiReport.siteOther,
      publicationDate,
      year,
      lifeCycle,
      articleType: input.aiReport.articleType,
      bahrainInTitle: headerCount > 0,
      headlineMentions: headerCount,
      bodyMentions: bodyCount,
      bahrainCentrality: input.aiReport.bahrainCentrality,
      overallTone: input.aiReport.overallTone,
      toneTowardBahrain: input.aiReport.toneTowardBahrain,
      dominantContext: input.aiReport.dominantContext,
      dominantNewsFrame: input.aiReport.dominantNewsFrame,
      newsFrameOther: input.aiReport.newsFrameOther,
      dominantImage: input.aiReport.dominantImage,
      imageOther: input.aiReport.imageOther,
      notesEn: input.aiReport.notes?.en,
      notesAr: input.aiReport.notes?.ar,
      model: getAnalysisModel(),
    },
  });
}

// Shapes a Prisma row into the plain-JSON form the API/UI work with (dates as ISO strings).
export function serializeCodedArticle(row: CodedArticleRow) {
  return {
    id: row.id,
    url: row.url,
    articleTitle: row.articleTitle,
    site: row.site,
    siteOther: row.siteOther,
    publicationDate: row.publicationDate ? row.publicationDate.toISOString() : null,
    year: row.year,
    lifeCycle: row.lifeCycle,
    articleType: row.articleType,
    bahrainInTitle: row.bahrainInTitle,
    headlineMentions: row.headlineMentions,
    bodyMentions: row.bodyMentions,
    bahrainCentrality: row.bahrainCentrality,
    overallTone: row.overallTone,
    toneTowardBahrain: row.toneTowardBahrain,
    dominantContext: row.dominantContext,
    dominantNewsFrame: row.dominantNewsFrame,
    newsFrameOther: row.newsFrameOther,
    dominantImage: row.dominantImage,
    imageOther: row.imageOther,
    notes: row.notesEn || row.notesAr ? { en: row.notesEn ?? "", ar: row.notesAr ?? "" } : undefined,
    model: row.model,
    createdAt: row.createdAt.toISOString(),
  };
}
