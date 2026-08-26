import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const COLUMNS = [
  "article_number",
  "coder_name",
  "coding_date",
  "site",
  "title",
  "url",
  "publication_date",
  "year",
  "life_cycle",
  "article_type",
  "article_type_other",
  "bahrain_in_title",
  "bahrain_in_body",
  "headline_mentions",
  "body_mentions",
  "total_mentions",
  "bahrain_centrality",
  "overall_tone",
  "tone_toward_bahrain",
  "dominant_context",
  "dominant_news_frame",
  "news_frame_other",
  "central_actor",
  "central_actor_other",
  "dominant_image",
  "image_other",
  "text_examples",
  "notes",
  "model",
  "created_at",
] as const;

function csvField(value: unknown): string {
  const str = value === null || value === undefined ? "" : String(value);
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

export async function GET() {
  const articles = await prisma.codedArticle.findMany({ orderBy: { articleNumber: "asc" } });

  const rows = articles.map((a) =>
    [
      a.articleNumber,
      a.coderName,
      a.codingDate.toISOString().slice(0, 10),
      a.site,
      a.articleTitle,
      a.url ?? "",
      a.publicationDate ? a.publicationDate.toISOString().slice(0, 10) : "",
      a.year ?? "",
      a.lifeCycle,
      a.articleType,
      a.articleTypeOther ?? "",
      a.bahrainInTitle ? "Yes" : "No",
      a.bahrainInBody ? "Yes" : "No",
      a.headlineMentions,
      a.bodyMentions,
      a.totalMentions,
      a.bahrainCentrality,
      a.overallTone,
      a.toneTowardBahrain,
      a.dominantContext,
      a.dominantNewsFrame,
      a.newsFrameOther ?? "",
      a.centralActor,
      a.centralActorOther ?? "",
      a.dominantImage,
      a.imageOther ?? "",
      a.textExamples ?? "",
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
