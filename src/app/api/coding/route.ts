import { NextResponse } from "next/server";
import { codingDraftSchema } from "@/lib/coding-schemas";
import { saveCodedArticle, serializeCodedArticle } from "@/lib/coding-store";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

// Saves a coder-reviewed draft (from POST /api/coding/draft, possibly edited) as the
// final, immutable record.
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const draft = codingDraftSchema.parse(body);

    const article = await saveCodedArticle(draft);

    return NextResponse.json(serializeCodedArticle(article));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Saving the coded article failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();

  const articles = await prisma.codedArticle.findMany({
    where: q ? { OR: [{ articleTitle: { contains: q } }, { url: { contains: q } }] } : undefined,
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return NextResponse.json(articles.map(serializeCodedArticle));
}
