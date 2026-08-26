import { prisma } from "./prisma";
import { getAnalysisModel } from "./analyzer";
import type { AnalysisReport } from "./schemas";

export function findAnalysisByUrl(url: string) {
  return prisma.analysisSource.findFirst({
    where: { url },
    include: { result: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function saveAnalysis(input: {
  sourceType: "URL" | "TEXT" | "FILE";
  title?: string;
  url?: string;
  publishedAt?: string;
  fileName?: string;
  filePath?: string;
  mimeType?: string;
  language: string;
  extractedText: string;
  report: AnalysisReport;
}) {
  return prisma.analysisSource.create({
    data: {
      sourceType: input.sourceType,
      title: input.title,
      url: input.url,
      publishedAt: input.publishedAt ? new Date(input.publishedAt) : undefined,
      fileName: input.fileName,
      filePath: input.filePath,
      mimeType: input.mimeType,
      language: input.language,
      extractedText: input.extractedText,
      result: {
        create: {
          sentiment: input.report.sentiment.toUpperCase(),
          confidence: input.report.confidence,
          summary: input.report.summary.en,
          analysisJson: input.report,
          model: getAnalysisModel(),
        },
      },
    },
    include: { result: true },
  });
}
