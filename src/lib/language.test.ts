import { describe, expect, it } from "vitest";
import { detectLanguage, textDirection } from "./language";

describe("detectLanguage", () => {
  it("detects English", () => {
    const text =
      "This is a sample English news article about trade agreements and economic growth in the region.";
    expect(detectLanguage(text)).toBe("en");
  });

  it("detects Spanish", () => {
    const text =
      "Este es un artículo de ejemplo en español sobre acuerdos comerciales y crecimiento económico en la región.";
    expect(detectLanguage(text)).toBe("es");
  });

  it("detects Italian", () => {
    const text =
      "Questo è un articolo di esempio in italiano su accordi commerciali e crescita economica nella regione.";
    expect(detectLanguage(text)).toBe("it");
  });

  it("detects Arabic", () => {
    const text = "هذا مقال تجريبي باللغة العربية حول الاتفاقيات التجارية والنمو الاقتصادي في المنطقة.";
    expect(detectLanguage(text)).toBe("ar");
  });

  it("falls back to English for text too short to classify", () => {
    expect(detectLanguage("hi")).toBe("en");
  });
});

describe("textDirection", () => {
  it("is rtl for Arabic", () => {
    expect(textDirection("ar")).toBe("rtl");
  });

  it("is ltr for everything else", () => {
    expect(textDirection("en")).toBe("ltr");
    expect(textDirection("es")).toBe("ltr");
    expect(textDirection("it")).toBe("ltr");
  });
});
