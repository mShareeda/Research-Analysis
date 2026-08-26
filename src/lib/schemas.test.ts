import { describe, expect, it } from "vitest";
import { isBilingualReport, resolveReportLanguage, type AnalysisReport } from "./schemas";

const bilingualReport = {
  sentiment: "positive",
  confidence: 0.8,
  sentimentKeywords: { en: ["growth"], ar: ["نمو"] },
  summary: { en: "English summary", ar: "ملخص عربي" },
  classificationBasis: { en: "English basis", ar: "أساس عربي" },
  supportingEvidence: {
    en: [{ quote: "Great news", explanation: "Positive framing" }],
    ar: [{ quote: "أخبار رائعة", explanation: "إطار إيجابي" }],
  },
  keyClaims: { en: ["Claim one"], ar: ["ادعاء واحد"] },
  toneSignals: { en: ["upbeat"], ar: ["متفائل"] },
  bahrainSentiment: "neutral",
  bahrainSentimentKeywords: { en: ["venue"], ar: ["مكان"] },
  bahrainClassificationBasis: { en: "Just the venue", ar: "مجرد المكان" },
  bahrainContext: ["Sport"],
  bahrainProminence: "Small",
  bahrainHeaderMentions: 1,
  bahrainBodyMentions: 2,
} as unknown as AnalysisReport;

const legacyFlatReport = {
  sentiment: "positive",
  confidence: 0.8,
  sentimentKeywords: ["growth"],
  summary: "Flat legacy summary",
  classificationBasis: "Flat legacy basis",
  supportingEvidence: [{ quote: "Great news", explanation: "Positive framing" }],
  keyClaims: ["Claim one"],
  toneSignals: ["upbeat"],
  bahrainSentiment: "neutral",
  bahrainSentimentKeywords: ["venue"],
  bahrainClassificationBasis: "Just the venue",
  bahrainContext: ["Sport"],
  bahrainProminence: "Small",
  bahrainHeaderMentions: 1,
  bahrainBodyMentions: 2,
} as unknown as AnalysisReport;

describe("isBilingualReport", () => {
  it("returns true for a report with {en, ar} narrative fields", () => {
    expect(isBilingualReport(bilingualReport)).toBe(true);
  });

  it("returns false for a legacy flat-shaped report", () => {
    expect(isBilingualReport(legacyFlatReport)).toBe(false);
  });
});

describe("resolveReportLanguage", () => {
  it("resolves the English side of a bilingual report", () => {
    const flat = resolveReportLanguage(bilingualReport, "en");
    expect(flat.summary).toBe("English summary");
    expect(flat.classificationBasis).toBe("English basis");
    expect(flat.sentimentKeywords).toEqual(["growth"]);
    expect(flat.keyClaims).toEqual(["Claim one"]);
    expect(flat.toneSignals).toEqual(["upbeat"]);
    expect(flat.supportingEvidence).toEqual([{ quote: "Great news", explanation: "Positive framing" }]);
    expect(flat.bahrainClassificationBasis).toBe("Just the venue");
    expect(flat.bahrainSentimentKeywords).toEqual(["venue"]);
  });

  it("resolves the Arabic side of a bilingual report", () => {
    const flat = resolveReportLanguage(bilingualReport, "ar");
    expect(flat.summary).toBe("ملخص عربي");
    expect(flat.classificationBasis).toBe("أساس عربي");
    expect(flat.keyClaims).toEqual(["ادعاء واحد"]);
    expect(flat.supportingEvidence).toEqual([{ quote: "أخبار رائعة", explanation: "إطار إيجابي" }]);
  });

  it("keeps language-independent fields identical regardless of language", () => {
    const en = resolveReportLanguage(bilingualReport, "en");
    const ar = resolveReportLanguage(bilingualReport, "ar");
    expect(en.sentiment).toBe(ar.sentiment);
    expect(en.confidence).toBe(ar.confidence);
    expect(en.bahrainSentiment).toBe(ar.bahrainSentiment);
    expect(en.bahrainContext).toEqual(ar.bahrainContext);
    expect(en.bahrainProminence).toBe(ar.bahrainProminence);
  });

  it("passes legacy flat-shaped reports through unchanged for either language", () => {
    const en = resolveReportLanguage(legacyFlatReport, "en");
    const ar = resolveReportLanguage(legacyFlatReport, "ar");
    expect(en.summary).toBe("Flat legacy summary");
    expect(ar.summary).toBe("Flat legacy summary");
    expect(en.keyClaims).toEqual(["Claim one"]);
    expect(ar.keyClaims).toEqual(["Claim one"]);
  });
});
