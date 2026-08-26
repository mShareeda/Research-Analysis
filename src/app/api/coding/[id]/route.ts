import { NextResponse } from "next/server";
import { serializeCodedArticle } from "@/lib/coding-store";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const article = await prisma.codedArticle.findUnique({ where: { id } });
  if (!article) {
    return NextResponse.json({ error: "Coded article not found." }, { status: 404 });
  }

  return NextResponse.json({
    ...serializeCodedArticle(article),
    extractedTextPreview: article.extractedText.slice(0, 5000),
  });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const existing = await prisma.codedArticle.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Coded article not found." }, { status: 404 });
  }

  await prisma.codedArticle.delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
}
