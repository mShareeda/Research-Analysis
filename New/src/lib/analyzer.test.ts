import { describe, expect, it } from "vitest";
import { countBahrainMentions, extractJson, normalizeReportJson } from "./analyzer";

describe("normalizeReportJson", () => {
  it("converts a percentage confidence to a decimal", () => {
    const result = normalizeReportJson({ confidence: 92 }) as Record<string, unknown>;
    expect(result.confidence).toBe(0.92);
  });

  it("parses a string confidence with a percent sign", () => {
    const result = normalizeReportJson({ confidence: "87%" }) as Record<string, unknown>;
    expect(result.confidence).toBe(0.87);
  });

  it("leaves an already-decimal confidence untouched", () => {
    const result = normalizeReportJson({ confidence: 0.75 }) as Record<string, unknown>;
    expect(result.confidence).toBe(0.75);
  });

  it("lowercases sentiment and bahrainSentiment", () => {
    const result = normalizeReportJson({ sentiment: "POSITIVE", bahrainSentiment: "Negative" }) as Record<
      string,
      unknown
    >;
    expect(result.sentiment).toBe("positive");
    expect(result.bahrainSentiment).toBe("negative");
  });

  it("wraps a bare string bilingual field into the same value for both languages", () => {
    const result = normalizeReportJson({ summary: "One summary, no languages" }) as Record<string, unknown>;
    expect(result.summary).toEqual({ en: "One summary, no languages", ar: "One summary, no languages" });
  });

  it("wraps a bare (non-bilingual) array field into the same array for both languages", () => {
    const result = normalizeReportJson({ keyClaims: "Only one claim" }) as Record<string, unknown>;
    expect(result.keyClaims).toEqual({ en: ["Only one claim"], ar: ["Only one claim"] });
  });

  it("normalizes each language of a well-formed bilingual string-array field independently", () => {
    const result = normalizeReportJson({
      toneSignals: {
        en: [{ tone: "optimistic" }, { description: "cautious framing" }, { unrelatedKey: "x" }],
        ar: [{}, "kept"],
      },
    }) as Record<string, unknown>;
    expect(result.toneSignals).toEqual({
      en: ["optimistic", "cautious framing", "unrelatedKey: x"],
      ar: ["kept"],
    });
  });

  it("trims oversized arrays to their max length per language", () => {
    const result = normalizeReportJson({
      keyClaims: {
        en: Array.from({ length: 20 }, (_, i) => `claim ${i}`),
        ar: Array.from({ length: 3 }, (_, i) => `مطالبة ${i}`),
      },
    }) as Record<string, unknown>;
    const keyClaims = result.keyClaims as { en: unknown[]; ar: unknown[] };
    expect(keyClaims.en.length).toBe(8);
    expect(keyClaims.ar.length).toBe(3);
  });

  it("unnests an over-applied bilingual quote/explanation inside supportingEvidence items", () => {
    // A model that over-applies the bilingual instruction may nest {en, ar} inside
    // quote/explanation too, instead of just at the top level. Each side must pick
    // its own language back out rather than fail validation as an object.
    const result = normalizeReportJson({
      supportingEvidence: {
        en: [{ quote: { en: "English quote", ar: "اقتباس عربي" }, explanation: { en: "English reason", ar: "سبب عربي" } }],
        ar: [{ quote: { en: "English quote", ar: "اقتباس عربي" }, explanation: { en: "English reason", ar: "سبب عربي" } }],
      },
    }) as Record<string, unknown>;
    expect(result.supportingEvidence).toEqual({
      en: [{ quote: "English quote", explanation: "English reason" }],
      ar: [{ quote: "اقتباس عربي", explanation: "سبب عربي" }],
    });
  });

  it("unnests an over-applied bilingual object inside a plain string-array item", () => {
    const result = normalizeReportJson({
      sentimentKeywords: {
        en: [{ en: "growth", ar: "نمو" }],
        ar: [{ en: "growth", ar: "نمو" }],
      },
    }) as Record<string, unknown>;
    expect(result.sentimentKeywords).toEqual({ en: ["growth"], ar: ["نمو"] });
  });

  it("drops an evidence item that has no usable quote or explanation after coercion", () => {
    const result = normalizeReportJson({
      supportingEvidence: {
        en: [{ quote: "kept", explanation: "kept too" }, { quote: {}, explanation: "orphaned" }],
        ar: [{ quote: "محفوظ", explanation: "محفوظ أيضاً" }],
      },
    }) as Record<string, unknown>;
    const evidence = result.supportingEvidence as { en: unknown[]; ar: unknown[] };
    expect(evidence.en).toEqual([{ quote: "kept", explanation: "kept too" }]);
  });

  it("trims oversized supportingEvidence arrays to their max length per language", () => {
    const item = { quote: "q", explanation: "e" };
    const result = normalizeReportJson({
      supportingEvidence: {
        en: Array.from({ length: 10 }, () => item),
        ar: [item],
      },
    }) as Record<string, unknown>;
    const evidence = result.supportingEvidence as { en: unknown[]; ar: unknown[] };
    expect(evidence.en.length).toBe(6);
    expect(evidence.ar.length).toBe(1);
  });

  it("filters bahrainContext to valid enum values and normalizes casing", () => {
    const result = normalizeReportJson({
      bahrainContext: ["sport", "POLITICS", "not-a-real-context", "Tourism"],
    }) as Record<string, unknown>;
    // "sport"/"POLITICS" aren't exact matches, so they get re-titled ("Sport"/"Politics").
    // "Tourism" is already an exact match, so it passes through as-is.
    expect(result.bahrainContext).toEqual(["Sport", "Politics", "Tourism"]);
  });

  it("defaults bahrainContext to an empty array when missing", () => {
    const result = normalizeReportJson({}) as Record<string, unknown>;
    expect(result.bahrainContext).toEqual([]);
  });

  it("normalizes bahrainProminence casing and rejects invalid values", () => {
    expect((normalizeReportJson({ bahrainProminence: "small" }) as Record<string, unknown>).bahrainProminence).toBe(
      "Small",
    );
    expect(
      (normalizeReportJson({ bahrainProminence: "huge" }) as Record<string, unknown>).bahrainProminence,
    ).toBeNull();
  });

  it("passes through non-object values unchanged", () => {
    expect(normalizeReportJson(null)).toBeNull();
    expect(normalizeReportJson("a string")).toBe("a string");
    expect(normalizeReportJson([1, 2, 3])).toEqual([1, 2, 3]);
  });
});

describe("extractJson", () => {
  it("returns a raw JSON object as-is", () => {
    expect(extractJson('{"a":1}')).toBe('{"a":1}');
  });

  it("extracts JSON from a fenced code block", () => {
    expect(extractJson('```json\n{"a":1}\n```')).toBe('{"a":1}');
  });

  it("extracts JSON between the first and last brace when there is surrounding prose", () => {
    expect(extractJson('Here is the analysis: {"a":1} — hope that helps!')).toBe('{"a":1}');
  });

  it("throws a descriptive error when no JSON can be found", () => {
    expect(() => extractJson("Sorry, I can't help with that.")).toThrow(/did not return valid JSON/);
  });
});

describe("countBahrainMentions", () => {
  it("counts English mentions in title and body separately", () => {
    const result = countBahrainMentions("Bahrain wins award", "Bahrain did well. Bahrain celebrated.");
    expect(result.headerCount).toBe(1);
    expect(result.bodyCount).toBe(2);
  });

  it("counts Spanish localized spellings (Baréin, Bahréin)", () => {
    const result = countBahrainMentions(null, "Baréin anunció un acuerdo. Bahréin es un país pequeño.");
    expect(result.bodyCount).toBe(2);
  });

  it("counts the Italian spelling (Bahrein)", () => {
    const result = countBahrainMentions(null, "Il Bahrein ha annunciato un accordo commerciale.");
    expect(result.bodyCount).toBe(1);
  });

  it("counts the Arabic spelling (البحرين)", () => {
    const result = countBahrainMentions(null, "أعلنت البحرين اليوم عن اتفاقية جديدة.");
    expect(result.bodyCount).toBe(1);
  });

  it("does not match the English word 'Bahrain' against unrelated Spanish/Italian text", () => {
    const result = countBahrainMentions(null, "España anunció un acuerdo con Italia y barrio nuevo.");
    expect(result.bodyCount).toBe(0);
  });

  it("returns zero for text with no Bahrain mention", () => {
    const result = countBahrainMentions("Unrelated headline", "Nothing about that country here.");
    expect(result.headerCount).toBe(0);
    expect(result.bodyCount).toBe(0);
  });
});
