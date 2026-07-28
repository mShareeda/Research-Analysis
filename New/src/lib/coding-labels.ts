// Arabic display labels for the coding guide's controlled vocabulary. The stored/exported
// value is always the canonical English enum (needed for consistent coding across the
// dataset) — this is a display-only translation layer for the Arabic result tab.

export const ARTICLE_TYPE_LABELS_AR: Record<string, string> = {
  News: "خبر",
  Report: "تقرير",
  Analysis: "تحليل",
  Opinion: "رأي",
};

export const LIFE_CYCLE_LABELS_AR: Record<string, string> = {
  Before: "قبل",
  During: "خلال",
  After: "بعد",
};

export const CENTRALITY_LABELS_AR: Record<string, string> = {
  Peripheral: "هامشي",
  Moderate: "متوسط",
  Central: "مركزي",
};

export const TONE_LABELS_AR: Record<string, string> = {
  Positive: "إيجابي",
  Negative: "سلبي",
  Neutral: "محايد",
};

export const CONTEXT_LABELS_AR: Record<string, string> = {
  Sports: "رياضي",
  Economic: "اقتصادي",
  Tourism: "سياحي",
  Political: "سياسي",
  Organizational: "تنظيمي",
  Security: "أمني",
  "Human Rights": "حقوق الإنسان",
  Cultural: "ثقافي",
  Technical: "تقني",
  Mixed: "مختلط",
};

export const NEWS_FRAME_LABELS_AR: Record<string, string> = {
  "Sporting Competition": "منافسة رياضية",
  "Organizational Success": "نجاح تنظيمي",
  "National Promotion": "ترويج وطني",
  "Economic Benefits": "فوائد اقتصادية",
  "Tourism Promotion": "ترويج سياحي",
  "Security and Stability": "الأمن والاستقرار",
  "Controversy or Criticism": "جدل أو انتقاد",
  "International Presence": "حضور دولي",
  Other: "أخرى",
};

export const IMAGE_LABELS_AR: Record<string, string> = {
  "Well Organized": "منظم جيدًا",
  Modern: "حديث",
  International: "دولي",
  Stable: "مستقر",
  Hospitable: "مضياف",
  "Attractive Destination": "وجهة جذابة",
  Developed: "متطور",
  Controversial: "مثير للجدل",
  Other: "أخرى",
};

export function translateEnum(dict: Record<string, string>, value: string, lang: "en" | "ar"): string {
  if (lang === "en") return value;
  return dict[value] ?? value;
}

// Static UI copy for the result panel — section headings and field labels, EN/AR.
export const UI_LABELS = {
  en: {
    articleInformation: "1. Article Information",
    bahrainMentions: "2. Bahrain Mentions",
    bahrainCentrality: "3. Bahrain Centrality",
    overallTone: "4. Overall Article Tone",
    toneTowardBahrain: "5. Tone Toward Bahrain",
    dominantContext: "6. Dominant Context",
    dominantNewsFrame: "7. Dominant News Frame",
    dominantImage: "8. Dominant Image Attribute of Bahrain",
    notes: "9. Notes",
    website: "Website",
    articleTitle: "Article Title",
    url: "URL",
    publicationDate: "Publication Date",
    year: "Year",
    lifeCycle: "Life Cycle",
    articleType: "Article Type",
    bahrainInTitle: "Is Bahrain mentioned in the headline?",
    headlineMentions: "Number of Bahrain mentions in the headline",
    bodyMentions: "Number of Bahrain mentions in the article body",
    yes: "Yes",
    no: "No",
    noNotes: "No additional notes.",
  },
  ar: {
    articleInformation: "١. معلومات المقال",
    bahrainMentions: "٢. ذكر البحرين",
    bahrainCentrality: "٣. مركزية البحرين",
    overallTone: "٤. النبرة العامة للمقال",
    toneTowardBahrain: "٥. النبرة تجاه البحرين",
    dominantContext: "٦. السياق السائد",
    dominantNewsFrame: "٧. الإطار الإخباري السائد",
    dominantImage: "٨. السمة السائدة لصورة البحرين",
    notes: "٩. ملاحظات",
    website: "الموقع الإخباري",
    articleTitle: "عنوان المقال",
    url: "الرابط",
    publicationDate: "تاريخ النشر",
    year: "السنة",
    lifeCycle: "دورة الحياة",
    articleType: "نوع المقال",
    bahrainInTitle: "هل ذُكرت البحرين في العنوان؟",
    headlineMentions: "عدد ذكر البحرين في العنوان",
    bodyMentions: "عدد ذكر البحرين في نص المقال",
    yes: "نعم",
    no: "لا",
    noNotes: "لا توجد ملاحظات إضافية.",
  },
} as const;
