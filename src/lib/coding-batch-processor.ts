import { countBahrainMentions } from "./analyzer";
import { buildCodingDraft, detectSiteFromUrl, saveCodedArticle } from "./coding-store";
import { prisma } from "./prisma";
import { extractFromUrl } from "./extractors";

// Runs sequentially (not in parallel), same reasoning as the sentiment pipeline's
// batch runner: avoid hammering the AI provider or the target sites, and one bad
// row never stops the rest of the batch. Unlike the single-URL flow, batch rows are
// saved automatically without a manual review step — bulk/unattended processing.
export async function runCodingBatch(batchId: string) {
  const items = await prisma.codingBatchItem.findMany({ where: { batchId, status: "PENDING" } });

  for (const item of items) {
    try {
      const extracted = await extractFromUrl(item.url);

      const { headerCount, bodyCount } = countBahrainMentions(extracted.title, extracted.text);
      if (headerCount + bodyCount === 0) {
        throw new Error("This article does not mention Bahrain.");
      }

      const site = detectSiteFromUrl(extracted.url ?? item.url);
      if (!site) {
        throw new Error("This URL's outlet is not one of the study's five recognized websites.");
      }

      // Publication Date and Year come only from the CSV's own columns 2/3
      // (set at upload time on the batch item) — never auto-extracted from the article.
      const draft = await buildCodingDraft({
        sourceType: "URL",
        url: extracted.url ?? item.url,
        articleTitle: extracted.title ?? extracted.url ?? item.url,
        extractedText: extracted.text,
        site,
        coderName: "",
        publicationDate: item.publicationDate?.toISOString(),
        year: item.year ?? undefined,
      });

      const article = await saveCodedArticle(draft);

      await prisma.codingBatchItem.update({
        where: { id: item.id },
        data: { status: "SUCCESS", articleId: article.id },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Coding failed.";
      await prisma.codingBatchItem.update({
        where: { id: item.id },
        data: { status: "FAILED", error: message },
      });
    }
  }

  await prisma.codingBatch.update({ where: { id: batchId }, data: { status: "DONE" } });
}
