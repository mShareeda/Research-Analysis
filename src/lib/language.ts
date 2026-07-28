import { franc } from "franc-min";

const LANGUAGE_CODE_MAP: Record<string, string> = {
  arb: "ar",
  eng: "en",
  spa: "es",
  ita: "it",
};

export function detectLanguage(text: string): string {
  const sample = text.slice(0, 4000);
  const detected = franc(sample, { minLength: 20 });
  return LANGUAGE_CODE_MAP[detected] ?? "en";
}

export function textDirection(language: string) {
  return language === "ar" ? "rtl" : "ltr";
}
