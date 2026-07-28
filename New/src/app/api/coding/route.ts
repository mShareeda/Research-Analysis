import { NextResponse } from "next/server";
import { countBahrainMentions } from "@/lib/analyzer";
import { codeArticle } from "@/lib/coding-analyzer";
import { saveCodedArticle, serializeCodedArticle } from "@/lib/coding-store";
import { extractFromUrl } from "@/lib/extractors";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const url = stringValue(formData.get("url"));
    if (!url) {
      return NextResponse.json({ error: "Provide a URL to code." }, { status: 400 });
    }

    // Publication Date and Year are user-entered — never auto-extracted from the article.
    const publicationDateInput = stringValue(formData.get("publicationDate"));
    const yearInput = stringValue(formData.get("year"));
    const year = /^\d{4}$/.test(yearInput) ? Number(yearInput) : undefined;

    const extracted = await extractFromUrl(url);

    const { headerCount, bodyCount } = countBahrainMentions(extracted.title, extracted.text);
    if (headerCount + bodyCount === 0) {
      return NextResponse.json(
        { error: "This article does not mention Bahrain. Only articles that reference Bahrain can be coded." },
        { status: 400 },
      );
    }

    const aiReport = await codeArticle({
      title: extracted.title,
      text: extracted.text,
      sourceLabel: extracted.url ?? url,
      publishedAt: publicationDateInput ? new Date(publicationDateInput) : undefined,
    });

    const article = await saveCodedArticle({
      sourceType: "URL",
      url: extracted.url,
      articleTitle: extracted.title ?? extracted.url ?? url,
      extractedText: extracted.text,
      publicationDate: publicationDateInput || undefined,
      year,
      aiReport,
    });

    return NextResponse.json(serializeCodedArticle(article));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Coding failed.";
    const status = message.includes("API_KEY") ? 500 : 400;
    return NextResponse.json({ error: message }, { status });
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

function stringValue(value: FormDataEntryValue | null) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : "";
}
