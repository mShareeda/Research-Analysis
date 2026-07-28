import { unlink } from "node:fs/promises";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const source = await prisma.analysisSource.findFirst({
    where: { OR: [{ id }, { result: { id } }] },
  });

  if (!source) {
    return NextResponse.json({ error: "Analysis not found." }, { status: 404 });
  }

  await prisma.analysisSource.delete({ where: { id: source.id } });

  if (source.filePath) {
    await unlink(source.filePath).catch(() => {
      // File already gone or never existed on disk — nothing to clean up.
    });
  }

  return new NextResponse(null, { status: 204 });
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const source = await prisma.analysisSource.findFirst({
    where: {
      OR: [{ id }, { result: { id } }],
    },
    include: { result: true },
  });

  if (!source || !source.result) {
    return NextResponse.json({ error: "Analysis not found." }, { status: 404 });
  }

  return NextResponse.json({
    source: {
      id: source.id,
      sourceType: source.sourceType,
      title: source.title,
      url: source.url,
      fileName: source.fileName,
      mimeType: source.mimeType,
      language: source.language,
      extractedTextPreview: source.extractedText.slice(0, 5000),
      createdAt: source.createdAt,
    },
    result: {
      id: source.result.id,
      sentiment: source.result.sentiment,
      confidence: source.result.confidence,
      summary: source.result.summary,
      analysisJson: source.result.analysisJson,
      model: source.result.model,
      createdAt: source.result.createdAt,
    },
  });
}
