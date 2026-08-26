import { NextResponse } from "next/server";
import { buildCodingDraft, detectSiteFromUrl } from "@/lib/coding-store";
import { countBahrainMentions } from "@/lib/analyzer";
import { extractFromPlainText, extractFromUrl } from "@/lib/extractors";

export const runtime = "nodejs";

// Analyzes one article (by URL, or pasted title/text when the URL can't be fetched)
// and returns an AI-coded draft. Nothing is saved — the coder reviews/edits the result
// and POSTs it to /api/coding to persist it.
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const coderName = stringValue(body.coderName);
    const publicationDateInput = stringValue(body.publicationDate);
    const yearInput = stringValue(body.year);
    const year = /^\d{4}$/.test(yearInput) ? Number(yearInput) : undefined;

    let extracted: { title?: string; text: string; url?: string };

    const url = stringValue(body.url);
    const pastedText = stringValue(body.pastedText);

    if (url) {
      extracted = await extractFromUrl(url);
    } else if (pastedText) {
      const parsed = extractFromPlainText(pastedText);
      const pastedTitle = stringValue(body.pastedTitle);
      extracted = { title: pastedTitle || parsed.title, text: parsed.text };
    } else {
      return NextResponse.json({ error: "Provide a URL, or paste the article title and text." }, { status: 400 });
    }

    const { headerCount, bodyCount } = countBahrainMentions(extracted.title, extracted.text);
    if (headerCount + bodyCount === 0) {
      return NextResponse.json(
        { error: "This article does not mention Bahrain. Only articles that reference Bahrain can be coded." },
        { status: 400 },
      );
    }

    const draft = await buildCodingDraft({
      sourceType: url ? "URL" : "PASTE",
      url: extracted.url ?? (url || null),
      articleTitle: extracted.title ?? extracted.url ?? url ?? "Untitled",
      extractedText: extracted.text,
      site: detectSiteFromUrl(extracted.url ?? url),
      coderName,
      publicationDate: publicationDateInput || undefined,
      year,
    });

    return NextResponse.json(draft);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Analysis failed.";
    const status = message.includes("API_KEY") ? 500 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

function stringValue(value: unknown): string {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : "";
}
