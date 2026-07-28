import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const COLUMNS = [
  "site",
  "site_other",
  "title",
  "url",
  "date",
  "year",
  "life_cycle",
  "article_type",
  "bahrain_in_title",
  "headline_mentions",
  "body_mentions",
  "bahrain_centrality",
  "overall_article_tone",
  "tone_toward_bahrain",
  "dominant_context",
  "dominant_news_frame",
  "news_frame_other",
  "dominant_bahrain_image",
  "image_other",
  "notes_en",
  "notes_ar",
  "model",
  "created_at",
] as const;

function csvField(value: unknown): string {
  const str = value === null || value === undefined ? "" : String(value);
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

export async function GET() {
  const articles = await prisma.codedArticle.findMany({ orderBy: { createdAt: "asc" } });

  const rows = articles.map((a) =>
    [
      a.site,
      a.siteOther ?? "",
      a.articleTitle,
      a.url ?? "",
      a.publicationDate ? a.publicationDate.toISOString().slice(0, 10) : "",
      a.year ?? "",
      a.lifeCycle,
      a.articleType,
      a.bahrainInTitle ? "Yes" : "No",
      a.headlineMentions,
      a.bodyMentions,
      a.bahrainCentrality,
      a.overallTone,
      a.toneTowardBahrain,
      a.dominantContext,
      a.dominantNewsFrame,
      a.newsFrameOther ?? "",
      a.dominantImage,
      a.imageOther ?? "",
      a.notesEn ?? "",
      a.notesAr ?? "",
      a.model,
      a.createdAt.toISOString(),
    ]
      .map(csvField)
      .join(","),
  );

  const csv = [COLUMNS.join(","), ...rows].join("\n");

  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="bahrain-f1-gp-coding-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
