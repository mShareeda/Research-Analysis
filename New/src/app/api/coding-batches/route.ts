import { NextResponse } from "next/server";
import { after } from "next/server";
import { runCodingBatch } from "@/lib/coding-batch-processor";
import { parseCodingBatchRows } from "@/lib/coding-csv";
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
    const rows = parseCodingBatchRows(content);

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "No http(s) URLs were found in the first column of this CSV." },
        { status: 400 },
      );
    }

    if (rows.length > maxBatchRows) {
      return NextResponse.json(
        {
          error: `This CSV has ${rows.length} URLs. The maximum per batch is ${maxBatchRows} — split it into smaller files.`,
        },
        { status: 400 },
      );
    }

    const batch = await prisma.codingBatch.create({
      data: {
        fileName: file.name,
        status: "RUNNING",
        items: {
          create: rows.map((row) => ({
            url: row.url,
            publicationDate: row.publicationDate ? new Date(row.publicationDate) : undefined,
            year: row.year,
            status: "PENDING",
          })),
        },
      },
    });

    after(() => runCodingBatch(batch.id));

    return NextResponse.json({ id: batch.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not start the batch.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
