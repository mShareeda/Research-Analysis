import { NextResponse } from "next/server";
import { analyzeSource, countBahrainMentions } from "@/lib/analyzer";
import { findAnalysisByUrl, saveAnalysis } from "@/lib/analysis-store";
import { extractFromFile, extractFromPlainText, extractFromUrl } from "@/lib/extractors";
import { detectLanguage } from "@/lib/language";
import { saveUpload } from "@/lib/storage";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const url = stringValue(formData.get("url"));
    const pastedText = stringValue(formData.get("text"));
    const file = formData.get("file");
    const force = stringValue(formData.get("force")) === "true";

    const inputCount = [url, pastedText, file instanceof File && file.size > 0 ? "file" : ""].filter(Boolean).length;
    if (inputCount !== 1) {
      return NextResponse.json({ error: "Provide exactly one source: URL, pasted text, or file." }, { status: 400 });
    }

    let sourceType: "URL" | "TEXT" | "FILE";
    let title: string | undefined;
    let extractedText: string;
    let sourceUrl: string | undefined;
    let publishedAt: string | undefined;
    let fileName: string | undefined;
    let filePath: string | undefined;
    let mimeType: string | undefined;
    let sourceLabel: string;

    if (url) {
      const extracted = await extractFromUrl(url);
      sourceType = "URL";
      title = extracted.title;
      extractedText = extracted.text;
      sourceUrl = extracted.url;
      publishedAt = extracted.publishedAt;
      sourceLabel = extracted.url ?? url;

      if (!force && sourceUrl) {
        const existing = await findAnalysisByUrl(sourceUrl);
        if (existing?.result) {
          return NextResponse.json({
            id: existing.result.id,
            sourceId: existing.id,
            duplicate: true,
            analyzedAt: existing.createdAt,
            report: existing.result.analysisJson,
          });
        }
      }
    } else if (pastedText) {
      const extracted = extractFromPlainText(pastedText);
      sourceType = "TEXT";
      title = extracted.title;
      extractedText = extracted.text;
      sourceLabel = "Pasted text";
    } else if (file instanceof File) {
      const upload = await saveUpload(file);
      const extracted = await extractFromFile(upload.fileName, upload.mimeType, upload.bytes);
      sourceType = "FILE";
      title = extracted.title;
      extractedText = extracted.text;
      fileName = upload.fileName;
      filePath = upload.filePath;
      mimeType = upload.mimeType;
      sourceLabel = upload.fileName;
    } else {
      return NextResponse.json({ error: "No analyzable source was provided." }, { status: 400 });
    }

    const { headerCount, bodyCount } = countBahrainMentions(title, extractedText);
    if (headerCount + bodyCount === 0) {
      return NextResponse.json(
        { error: "This article does not mention Bahrain. Only articles that reference Bahrain can be analysed." },
        { status: 400 },
      );
    }

    const language = detectLanguage(extractedText);
    const report = await analyzeSource({
      title,
      text: extractedText,
      language,
      sourceLabel,
    });

    const source = await saveAnalysis({
      sourceType,
      title,
      url: sourceUrl,
      publishedAt,
      fileName,
      filePath,
      mimeType,
      language,
      extractedText,
      report,
    });

    return NextResponse.json({
      id: source.result?.id,
      sourceId: source.id,
      report,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Analysis failed.";
    const status = message.includes("OPENAI_API_KEY") ? 500 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

function stringValue(value: FormDataEntryValue | null) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : "";
}
