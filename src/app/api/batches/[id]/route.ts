import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const batch = await prisma.analysisBatch.findUnique({
    where: { id },
    include: { items: { orderBy: { createdAt: "asc" } } },
  });

  if (!batch) {
    return NextResponse.json({ error: "Batch not found." }, { status: 404 });
  }

  return NextResponse.json({
    id: batch.id,
    fileName: batch.fileName,
    status: batch.status,
    createdAt: batch.createdAt,
    items: batch.items.map((item) => ({
      id: item.id,
      url: item.url,
      status: item.status,
      error: item.error,
      sourceId: item.sourceId,
    })),
  });
}
