import { prisma } from "./prisma";
import { findAnalysisByUrl, saveAnalysis } from "./analysis-store";
import { analyzeSource, countBahrainMentions } from "./analyzer";
import { extractFromUrl } from "./extractors";
import { detectLanguage } from "./language";

// Runs sequentially (not in parallel) so we don't hammer the AI provider's
// rate limit or the target sites all at once. One bad row never stops the batch.
export async function runBatch(batchId: string) {
  // Only PENDING items — on a retry, already-SUCCESS rows must not be re-analyzed.
  const items = await prisma.analysisBatchItem.findMany({ where: { batchId, status: "PENDING" } });

  for (const item of items) {
    try {
      const extracted = await extractFromUrl(item.url);

      // Skip the AI call entirely if this exact URL was already analyzed before.
      const existing = extracted.url ? await findAnalysisByUrl(extracted.url) : null;
      if (existing?.result) {
        await prisma.analysisBatchItem.update({
          where: { id: item.id },
          data: { status: "SUCCESS", sourceId: existing.id },
        });
        continue;
      }

      const { headerCount, bodyCount } = countBahrainMentions(extracted.title, extracted.text);
      if (headerCount + bodyCount === 0) {
        throw new Error("This article does not mention Bahrain.");
      }

      const language = detectLanguage(extracted.text);
      const report = await analyzeSource({
        title: extracted.title,
        text: extracted.text,
        language,
        sourceLabel: extracted.url ?? item.url,
      });

      const source = await saveAnalysis({
        sourceType: "URL",
        title: extracted.title,
        url: extracted.url,
        publishedAt: extracted.publishedAt,
        language,
        extractedText: extracted.text,
        report,
      });

      await prisma.analysisBatchItem.update({
        where: { id: item.id },
        data: { status: "SUCCESS", sourceId: source.id },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Analysis failed.";
      await prisma.analysisBatchItem.update({
        where: { id: item.id },
        data: { status: "FAILED", error: message },
      });
    }
  }

  await prisma.analysisBatch.update({ where: { id: batchId }, data: { status: "DONE" } });
}
