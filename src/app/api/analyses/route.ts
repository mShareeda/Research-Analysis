import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();
  const sentiment = searchParams.get("sentiment")?.toUpperCase();

  const analyses = await prisma.analysisSource.findMany({
    where: {
      ...(q ? { OR: [{ title: { contains: q } }, { url: { contains: q } }] } : {}),
      ...(sentiment && ["POSITIVE", "NEGATIVE", "NEUTRAL"].includes(sentiment)
        ? { result: { sentiment } }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { result: true },
  });

  return NextResponse.json(
    analyses.map((source) => {
      const json = source.result?.analysisJson as Record<string, unknown> | null;
      return {
        id: source.result?.id,
        sourceId: source.id,
        title: source.title ?? source.url ?? source.fileName ?? "Untitled source",
        sourceType: source.sourceType,
        language: source.language,
        createdAt: source.createdAt,
        sentiment: source.result?.sentiment,
        bahrainSentiment: typeof json?.bahrainSentiment === "string" ? json.bahrainSentiment : null,
        confidence: source.result?.confidence,
        summary: source.result?.summary,
      };
    }),
  );
}
