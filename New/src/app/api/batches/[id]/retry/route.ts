import { NextResponse, after } from "next/server";
import { runBatch } from "@/lib/batch-processor";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}) as Record<string, unknown>);
  const itemId = typeof body.itemId === "string" ? body.itemId : undefined;

  const batch = await prisma.analysisBatch.findUnique({ where: { id } });
  if (!batch) {
    return NextResponse.json({ error: "Batch not found." }, { status: 404 });
  }

  const { count } = await prisma.analysisBatchItem.updateMany({
    where: { batchId: id, status: "FAILED", ...(itemId ? { id: itemId } : {}) },
    data: { status: "PENDING", error: null },
  });

  if (count === 0) {
    return NextResponse.json({ error: "No failed items to retry." }, { status: 400 });
  }

  await prisma.analysisBatch.update({ where: { id }, data: { status: "RUNNING" } });
  after(() => runBatch(id));

  return NextResponse.json({ id });
}
