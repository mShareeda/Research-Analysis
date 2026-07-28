import { describe, expect, it } from "vitest";
import { classifyLifeCycle, normalizeCodingJson } from "./coding-analyzer";

describe("classifyLifeCycle", () => {
  it("classifies a date during the race weekend", () => {
    expect(classifyLifeCycle(new Date("2023-03-04"))).toBe("During");
  });

  it("classifies a date within a week before the race weekend", () => {
    expect(classifyLifeCycle(new Date("2023-02-27"))).toBe("Before");
  });

  it("classifies a date within a week after the race weekend", () => {
    expect(classifyLifeCycle(new Date("2023-03-10"))).toBe("After");
  });

  it("returns undefined for a date far outside any race window", () => {
    expect(classifyLifeCycle(new Date("2023-06-01"))).toBeUndefined();
  });

  it("returns undefined for a year with no known race weekend", () => {
    expect(classifyLifeCycle(new Date("2019-03-04"))).toBeUndefined();
  });

  it("returns undefined when no date is given", () => {
    expect(classifyLifeCycle(undefined)).toBeUndefined();
    expect(classifyLifeCycle(null)).toBeUndefined();
  });

  it("handles each configured race year", () => {
    expect(classifyLifeCycle(new Date("2021-03-27"))).toBe("During");
    expect(classifyLifeCycle(new Date("2022-03-19"))).toBe("During");
    expect(classifyLifeCycle(new Date("2024-03-01"))).toBe("During");
    expect(classifyLifeCycle(new Date("2025-04-12"))).toBe("During");
  });
});

describe("normalizeCodingJson", () => {
  it("passes through already-valid enum values unchanged", () => {
    const result = normalizeCodingJson({
      site: "ESPN",
      articleType: "News",
      lifeCycle: "During",
      bahrainCentrality: "Central",
      overallTone: "Positive",
      toneTowardBahrain: "Neutral",
      dominantContext: "Sports",
      dominantNewsFrame: "Sporting Competition",
      dominantImage: "Modern",
    }) as Record<string, unknown>;
    expect(result.site).toBe("ESPN");
    expect(result.overallTone).toBe("Positive");
  });

  it("case-insensitively matches enum values", () => {
    const result = normalizeCodingJson({
      site: "espn",
      overallTone: "POSITIVE",
      bahrainCentrality: "central",
    }) as Record<string, unknown>;
    expect(result.site).toBe("ESPN");
    expect(result.overallTone).toBe("Positive");
    expect(result.bahrainCentrality).toBe("Central");
  });

  it("falls back to a safe default for an unrecognized enum value", () => {
    const result = normalizeCodingJson({ dominantContext: "not-a-real-context" }) as Record<string, unknown>;
    expect(result.dominantContext).toBe("Mixed");
  });

  it("falls back to a safe default for an unrecognized lifeCycle value", () => {
    const result = normalizeCodingJson({ lifeCycle: "sometime" }) as Record<string, unknown>;
    expect(result.lifeCycle).toBe("During");
  });

  it("drops blank optional free-text fields", () => {
    const result = normalizeCodingJson({ siteOther: "  ", notes: "" }) as Record<string, unknown>;
    expect(result.siteOther).toBeUndefined();
    expect(result.notes).toBeUndefined();
  });

  it("keeps a non-blank optional free-text field, trimmed", () => {
    const result = normalizeCodingJson({ siteOther: "  Kooora  " }) as Record<string, unknown>;
    expect(result.siteOther).toBe("Kooora");
  });

  it("wraps a bare string notes value into both languages", () => {
    const result = normalizeCodingJson({ notes: "  worth noting  " }) as Record<string, unknown>;
    expect(result.notes).toEqual({ en: "worth noting", ar: "worth noting" });
  });

  it("keeps a well-formed bilingual notes object, trimmed", () => {
    const result = normalizeCodingJson({ notes: { en: " kept ", ar: " محفوظ " } }) as Record<string, unknown>;
    expect(result.notes).toEqual({ en: "kept", ar: "محفوظ" });
  });

  it("drops notes entirely when both languages are blank", () => {
    const result = normalizeCodingJson({ notes: { en: "", ar: "  " } }) as Record<string, unknown>;
    expect(result.notes).toBeUndefined();
  });

  it("passes through non-object values unchanged", () => {
    expect(normalizeCodingJson(null)).toBeNull();
    expect(normalizeCodingJson("a string")).toBe("a string");
    expect(normalizeCodingJson([1, 2, 3])).toEqual([1, 2, 3]);
  });
});
