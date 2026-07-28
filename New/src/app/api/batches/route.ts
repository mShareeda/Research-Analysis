import { NextResponse } from "next/server";
import { after } from "next/server";
import { runBatch } from "@/lib/batch-processor";
import { parseUrlsFromCsv } from "@/lib/csv";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const maxCsvMb = Number(process.env.MAX_UPLOAD_MB ?? "20");
const maxBatchRows = Number(process.env.MAX_BATCH_ROWS ?? "200");

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "Upload a CSV file." }, { status: 400 });
    }

    if (file.size > maxCsvMb * 1024 * 1024) {
      return NextResponse.json({ error: `CSV is too large. Maximum upload size is ${maxCsvMb}MB.` }, { status: 400 });
    }

    const content = await file.text();
    const urls = parseUrlsFromCsv(content);

    if (urls.length === 0) {
      return NextResponse.json(
        { error: "No http(s) URLs were found in the first column of this CSV." },
        { status: 400 },
      );
    }

    if (urls.length > maxBatchRows) {
      return NextResponse.json(
        {
          error: `This CSV has ${urls.length} URLs. The maximum per batch is ${maxBatchRows} — split it into smaller files.`,
        },
        { status: 400 },
      );
    }

    const batch = await prisma.analysisBatch.create({
      data: {
        fileName: file.name,
        status: "RUNNING",
        items: {
          create: urls.map((url) => ({ url, status: "PENDING" })),
        },
      },
    });

    after(() => runBatch(batch.id));

    return NextResponse.json({ id: batch.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not start the batch.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
