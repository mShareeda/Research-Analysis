// Arabic display labels for the coding form's controlled vocabulary. The stored/exported
// value is always the canonical English enum (needed for a consistent dataset) — this is
// a display-only translation layer. The coding UI is Arabic-only, matching the original
// "استمارة تحليل المضمون" form.

export const ARTICLE_TYPE_LABELS_AR: Record<string, string> = {
  News: "خبر",
  Report: "تقرير",
  Analysis: "تحليل",
  Opinion: "مقال رأي",
  Interview: "مقابلة",
  Preview: "معاينة",
  Review: "مراجعة",
  Other: "أخرى",
};

export const LIFE_CYCLE_LABELS_AR: Record<string, string> = {
  Before: "قبل السباق بأسبوع",
  During: "أيام السباق الثلاثة",
  After: "بعد السباق بأسبوع",
};

export const CENTRALITY_LABELS_AR: Record<string, string> = {
  Peripheral: "هامشية",
  Moderate: "متوسطة",
  Central: "محورية",
};

export const TONE_LABELS_AR: Record<string, string> = {
  Positive: "إيجابي",
  Negative: "سلبي",
  Neutral: "محايد",
  NotApplicable: "غير حاضر / غير منطبق",
};

export const CONTEXT_LABELS_AR: Record<string, string> = {
  Sports: "رياضي",
  Organizational: "تنظيمي",
  Economic: "اقتصادي",
  Tourism: "سياحي",
  Political: "سياسي",
  Security: "أمني",
  HumanRightsDisputed: "حقوقي / جدلي",
  CulturalHeritage: "ثقافي / حضاري",
  TechnicalLogistical: "تقني / لوجستي",
  Mixed: "مختلط",
  NotApplicable: "غير منطبق",
};

export const NEWS_FRAME_LABELS_AR: Record<string, string> = {
  "Sporting Competition": "المنافسة الرياضية",
  "Organizational Success": "النجاح التنظيمي",
  "National Promotion": "الترويج الوطني",
  "Economic Benefits": "المكاسب الاقتصادية",
  "Tourism Promotion": "الجذب السياحي",
  "Security and Stability": "الأمن والاستقرار",
  "Controversy or Criticism": "الجدل / الانتقاد",
  "International Presence": "الحضور الدولي",
  "Humanitarian Aspect": "الجانب الإنساني",
  "Mixed Frame": "إطار مختلط",
  Other: "أخرى",
};

export const CENTRAL_ACTOR_LABELS_AR: Record<string, string> = {
  "Kingdom of Bahrain": "مملكة البحرين",
  "Formula 1": "الفورمولا 1",
  Drivers: "السائقون",
  Teams: "الفرق",
  Organizers: "المنظمون",
  Audience: "الجمهور",
  "Official or Government Bodies": "الجهات الرسمية أو الحكومية",
  "Sponsors or Economy": "الرعاة / الاقتصاد",
  Other: "أخرى",
};

export const IMAGE_LABELS_AR: Record<string, string> = {
  Organized: "منظمة",
  "Modern and Advanced": "حديثة / متطورة",
  Global: "عالمية",
  Hospitable: "مضيافة",
  Stable: "مستقرة",
  "Tourism Attractive": "جاذبة سياحيا",
  "Economically Influential": "مؤثرة اقتصاديا",
  Controversial: "مثيرة للجدل",
  "Marginal Presence": "هامشية الحضور",
  "Neutral or Descriptive": "محايدة / وصفية",
  Other: "أخرى",
  NotApplicable: "غير منطبق",
};

export function translateEnum(dict: Record<string, string>, value: string): string {
  return dict[value] ?? value;
}

// Static UI copy for the coding form/result view — section headings and field labels.
export const UI_LABELS = {
  axis1: "المحور 1: البيانات التعريفية والتوثيقية",
  articleNumber: "رقم المادة",
  coderName: "اسم المرمز",
  codingDate: "تاريخ الترميز",
  publicationDate: "تاريخ النشر",
  site: "الموقع الإخباري",
  year: "السنة",
  lifeCycle: "المرحلة الزمنية للتغطية",
  articleType: "نوع المادة",
  articleTitle: "عنوان المادة",
  url: "الرابط",

  axis2: "المحور 2: بيانات ذكر البحرين في المادة",
  bahrainInTitle: "ذكر البحرين في العنوان",
  bahrainInBody: "ذكر البحرين في المتن",
  headlineMentions: "عدد مرات ذكر البحرين في العنوان",
  bodyMentions: "عدد مرات ذكر البحرين في المتن",
  totalMentions: "إجمالي عدد مرات ذكر البحرين",
  bahrainCentrality: "مركزية البحرين في المادة",

  axis3: "المحور 3: اتجاهات المعالجة الإعلامية",
  overallTone: "الاتجاه العام للمادة",
  toneTowardBahrain: "اتجاه تمثيل البحرين",

  axis4: "المحور 4: فئات السياق والإطار الإخباري والفاعل المحوري",
  dominantContext: "السياق الغالب لذكر البحرين",
  dominantNewsFrame: "الإطار الخبري الغالب",
  centralActor: "الفاعل أو الجهة المحورية",
  dominantImage: "الصفة الذهنية الأبرز المنسوبة إلى البحرين",

  axis5: "المحور 5: بيانات نوعية توثيقية",
  textExamples: "أمثلة دالة من النص",
  notes: "ملاحظات الباحث / المرمز",

  yes: "نعم",
  no: "لا",
  noNotes: "لا توجد ملاحظات.",
  otherSpecify: "برجاء الكتابة",
} as const;
