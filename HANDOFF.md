# Research Analysis App Handoff

Last updated: 2026-08-26

## Current State

The app is a local-first Next.js + TypeScript research analysis tool focused on Bahrain media monitoring.

It supports:
- URL analysis (Bahrain-mention gate: rejects articles that don't mention Bahrain)
- Pasted text analysis
- PDF, DOCX, TXT, Markdown upload analysis
- CSV batch analysis: upload a CSV of URLs (one per row, header optional, max `MAX_BATCH_ROWS` rows), each row runs through the same URL pipeline in the background and reports success/failure per row
- Duplicate URL detection: re-analyzing a URL that's already saved returns the existing result instead of burning another AI call, with a "Re-analyze anyway" override
- History search (title/URL) and sentiment filter
- Two-track AI sentiment analysis: story-level and Bahrain-specific
- Bilingual (English/Arabic) results: every new analysis is generated in both languages in one AI call, with an EN/عربي tab in the result panel to switch (also flips text direction and what gets exported to PDF). Analyses saved before this feature only have one language and show no tab.
- OpenRouter as the default AI provider
- OpenAI as an optional provider
- Local SQLite persistence through Prisma
- Local upload storage under `uploads/`
- PDF export of analysis results
- Delete saved analyses
- Header logo from `public/logo.png`
- A second, separate pipeline: **استمارة تحليل المضمون (F1 GP Study Coding)** — academic content-analysis coding of Bahrain F1 Grand Prix articles against the researcher's own `استمارة تحليل المضمون.docx` form (site, life cycle, centrality, tone, dominant context/frame/image, central actor, etc.), with URL/pasted-text/CSV-batch input, an AI-draft → coder-review → save workflow (batch mode saves automatically, no review), an Arabic-only UI, a print-to-PDF export matching the original form layout, and CSV export. Switched to via a top-level "Sentiment Monitoring" / "استمارة تحليل المضمون" toggle in `app-shell.tsx`. See the dedicated section below.

The dev server runs at:

```bash
http://localhost:3000
```

## Important Files

- `src/components/app-shell.tsx` — top-level shell (logo, heading, mode toggle) that swaps between `ResearchWorkspace` and `CodingWorkspace`
- `src/components/research-workspace.tsx` — main sentiment-monitoring UI, history list, analysis panel
- `src/app/api/analyze/route.ts` — source ingestion, Bahrain gate, analysis call, save result
- `src/app/api/analyses/route.ts` — saved history list
- `src/app/api/analyses/[id]/route.ts` — saved analysis detail + DELETE
- `src/lib/analyzer.ts` — two-track AI analysis (story + Bahrain), OpenRouter/OpenAI adapter, normalization
- `src/lib/schemas.ts` — Zod schemas for analysis report
- `src/lib/extractors.ts` — URL, PDF, DOCX, TXT, Markdown extraction
- `src/lib/export-pdf.ts` — client-side PDF generation via jsPDF
- `src/lib/format.ts` — shared date formatting utilities (formatDate, formatDateTime)
- `src/lib/storage.ts` — local upload persistence
- `src/lib/language.ts` — language detection
- `src/lib/analysis-store.ts` — shared `saveAnalysis` helper (writes AnalysisSource + AnalysisResult) and `findAnalysisByUrl` (duplicate lookup), used by both `/api/analyze` and the batch processor
- `src/lib/csv.ts` — pulls URLs out of an uploaded CSV (first column, header optional)
- `src/lib/batch-processor.ts` — sequential background loop that runs each batch URL through the normal analysis pipeline
- `src/app/api/batches/route.ts` — POST: parse CSV, create `AnalysisBatch` + items, kick off background processing via `after()`
- `src/app/api/batches/[id]/route.ts` — GET: batch status + per-item results, polled by the UI
- `src/app/api/batches/[id]/retry/route.ts` — POST: resets FAILED items back to PENDING and re-runs the batch
- `prisma/schema.prisma` — production Prisma models (MySQL)
- `prisma/local/schema.prisma` — local dev Prisma models (SQLite), kept in sync by hand with the file above
- `.env` — `DATABASE_URL="file:./dev.db"`
- `.env.local` — runtime provider keys/config (git-ignored)
- `README.md` — local setup instructions
- `vitest.config.ts` — unit test config (see Testing section below)
- `idea.md` — running list of proposed system improvements; check items off there as they're implemented
- `استمارة تحليل المضمون.docx` — the researcher's actual content-analysis coding form; source of truth for every field/option in the coding pipeline (superseded `Analysis_Guide.md`, kept below only for historical reference)
- `Analysis_Guide.md` — **historical/superseded** — an earlier, simpler English-language version of the coding scheme; not read by any code anymore
- `src/components/coding-workspace.tsx` — coding UI (URL/paste/CSV input, coder-name field, the `DraftReviewForm` editable review step, read-only `CodedArticleView` for saved rows, history, CSV export, print link)
- `src/lib/coding-schemas.ts` — controlled-vocabulary enums + Zod schemas (`codingAiSchema` = AI-facing, `codingDraftSchema` = draft/save payload, `codedArticleSchema` = stored/returned shape) matching `استمارة تحليل المضمون.docx` exactly
- `src/lib/coding-labels.ts` — Arabic-only display labels for the controlled vocabulary + `UI_LABELS` (section/field labels), used by the workspace, the saved-article view, and the print page
- `src/lib/coding-analyzer.ts` — AI call producing the coding report, `classifyLifeCycle` (deterministic Bahrain-GP-weekend date classifier), `normalizeCodingJson` (messy-output coercion)
- `src/lib/coding-store.ts` — `buildCodingDraft` (extraction + AI call → draft, not persisted), `detectSiteFromUrl` (deterministic hostname → one of the 5 outlets), `saveCodedArticle` (persists a draft, assigns `articleNumber`), `serializeCodedArticle` (Prisma row → JSON-safe shape)
- `src/lib/coding-csv.ts` — `parseCodingBatchRows`, parses `url, publication_date, year` CSV rows for the coding batch pipeline (the extra two columns are optional and user-supplied, never auto-extracted)
- `src/lib/coding-batch-processor.ts` — sequential background loop for CSV batches: draft + save with no manual review, mirrors `batch-processor.ts`
- `src/app/api/coding/draft/route.ts` — POST: analyze one URL or pasted text, return a draft (nothing saved)
- `src/app/api/coding/route.ts` — POST: save a (possibly coder-edited) draft as the final record; GET: list coded articles (`?q=` search)
- `src/app/api/coding/[id]/route.ts` — GET detail (+ text preview), DELETE. No PATCH — coded rows are immutable once saved (edits happen before saving, in the draft-review step).
- `src/app/api/coding/export/route.ts` — GET: CSV export of every coded article, ordered by `articleNumber`
- `src/app/api/coding-batches/route.ts`, `[id]/route.ts`, `[id]/retry/route.ts` — CSV batch upload/status/retry, mirrors `/api/batches`
- `src/app/coding/[id]/print/page.tsx` + `print-button.tsx` — Arabic RTL print/PDF page mirroring the original form's layout; "حفظ كـ PDF" calls `window.print()` (see "PDF export" under the pipeline section below for why this avoids jsPDF)

## Runtime Configuration

Database — **two separate schemas, deliberately**: `prisma/schema.prisma` (MySQL) is what
production (Hostinger's "Web Apps" hosting) uses; `prisma/local/schema.prisma` (SQLite) is what
local dev uses. They're not interchangeable — see "Why MySQL in production" in `DEPLOY.md` for
the full reasoning (short version: that hosting product gives every deploy a fresh, isolated,
non-persistent build directory, so a SQLite file can't survive between the build step and the
app serving traffic). Keep both schemas' models in sync by hand when the data model changes.

```bash
# .env.local, local dev — resolves relative to prisma/local/schema.prisma's directory
DATABASE_URL="file:./dev.db"   # → prisma/local/dev.db
```

```bash
# Hostinger's Environment Variables panel, production
DATABASE_URL="mysql://<user>:<password>@localhost:3306/<database>"
```

OpenRouter is the default provider:

```bash
AI_PROVIDER="openrouter"
OPENROUTER_MODEL="openrouter/auto"
OPENROUTER_SITE_URL="http://localhost:3000"
OPENROUTER_APP_NAME="Research Analysis"
```

The OpenRouter key is stored in `.env.local` (git-ignored). Rotate it in OpenRouter if it was ever pasted in chat.

Optional limits (all have defaults, only need setting to override):

```bash
MAX_SOURCE_CHARS="60000"   # extracted text is truncated to this length before analysis (extractors.ts)
MAX_UPLOAD_MB="20"         # cap for file uploads (storage.ts) and CSV uploads (batches/route.ts)
MAX_BATCH_ROWS="200"       # max URLs per CSV batch (batches/route.ts)
```

## Commands That Should Pass

```bash
npm run typecheck
npm run lint
npm run build
npm test
```

Prisma — local (SQLite):

```bash
npm run prisma:generate:local   # regenerate client after schema changes
npm run prisma:migrate:local -- --name <name>   # apply schema changes
```

Prisma — production schema (MySQL, `prisma/schema.prisma`, no `:local` suffix) needs a
reachable MySQL connection to run `migrate dev` interactively, which isn't available from this
machine — see "If a future schema change needs a new migration" in `DEPLOY.md` for the offline
workaround.

## Analysis Logic

### Bahrain Gate

Before calling the AI, `route.ts` counts Bahrain mentions in the title and body using `countBahrainMentions` (`analyzer.ts`). If the total is zero the request is rejected with a 400 error:

> "This article does not mention Bahrain. Only articles that reference Bahrain can be analysed."

The gate matches English "Bahrain" plus localized spellings: Spanish "Baréin"/"Bahréin", Italian "Bahrein", and Arabic "البحرين" (`BAHRAIN_PATTERNS` in `analyzer.ts`). Add more patterns there if new source languages come up.

### Language Detection

`detectLanguage` (`language.ts`) uses the `franc-min` package to detect Arabic, English, Spanish, or Italian (falls back to `en` for anything else or text too short to classify). The detected code (`ar`/`en`/`es`/`it`) is stored on `AnalysisSource.language` and passed to the AI as context, but no longer picks which language the AI responds in — every analysis is now bilingual (see below). The result panel's language tab defaults to Arabic when the detected source language is `ar`, English otherwise; `textDirection`'s RTL/LTR logic is superseded there by the tab's own `viewLang` state (`research-workspace.tsx`), but `textDirection` is still exported from `language.ts` and covered by tests.

### Bilingual Results (EN/AR)

Every new analysis produces both an English and an Arabic version of all narrative text in **one** AI call — cheaper than two calls and guarantees `sentiment`/`confidence`/enums stay identical across languages since only the wording differs.

- **Storage shape** (`schemas.ts`): narrative fields (`summary`, `classificationBasis`, `bahrainClassificationBasis`, `sentimentKeywords`, `bahrainSentimentKeywords`, `keyClaims`, `toneSignals`, `supportingEvidence`) are stored as `{ en, ar }`. Enum/number fields (`sentiment`, `confidence`, `bahrainSentiment`, `bahrainContext`, `bahrainProminence`, mention counts) stay flat since they don't need translation. `supportingEvidence` quotes are translated too — not necessarily verbatim in the non-source-language tab.
- **`resolveReportLanguage(report, lang)`** (`schemas.ts`) flattens a bilingual `AnalysisReport` down to a `FlatAnalysisReport` (today's original single-language shape) for one language — used by the UI and PDF export, so neither had to be restructured. `isBilingualReport(report)` detects whether a saved report actually has both languages (new) vs. a legacy flat report (old) — the language tab is hidden for legacy rows via this check.
- **AI side** (`analyzer.ts`): `aiReportSchema` mirrors the bilingual shape; `normalizeReportJson` gained `normalizeBilingualText`/`normalizeBilingualStringArray`/`normalizeBilingualEvidence` to defensively coerce a model that ignores the bilingual instruction (bare string/array) into `{en: x, ar: x}` rather than failing validation. It also unwinds the opposite mistake — a model that over-applies the instruction and nests `{en, ar}` a level too deep (inside a `supportingEvidence` item's `quote`/`explanation`, or inside a single string-array item) — see "OpenRouter over-nested bilingual fields" below.
- **UI** (`research-workspace.tsx`): a small EN/عربي segmented control (`.langSegmented` in `globals.css`, a 2-column variant of the existing `.segmented` tab styling) appears in the result header only when `isBilingualReport` is true. Switching it re-resolves `flatReport` and flips the `<article dir={...}>` direction.
- **Known limitation**: PDF export (jsPDF + Helvetica) can't shape/render Arabic glyphs properly — exporting the Arabic tab will look broken in the PDF. This is a pre-existing jsPDF limitation, not something this feature fixes.

### Two-Track Sentiment

The AI returns two independent sentiment ratings:

| Track | Field | Label in UI |
|-------|-------|-------------|
| Story | `sentiment` | 📰 |
| Bahrain | `bahrainSentiment` | 🇧🇭 |

Bahrain framing can differ from the overall story. A race report filed from Bahrain is neutral toward Bahrain even if the story is positive about the winner.

### Bahrain Analysis Fields

- `bahrainHeaderMentions` — count of "Bahrain" in the article title (computed, not AI)
- `bahrainBodyMentions` — count of "Bahrain" in the article body (computed, not AI)
- `bahrainContext` — array of contexts: `Sport | Politics | Economy | Diplomacy | Culture | Tourism`
- `bahrainProminence` — `Small | Medium | Large | null`
- `bahrainSentiment` — `positive | negative | neutral`
- `bahrainSentimentKeywords` — keywords tied to Bahrain's framing specifically
- `bahrainClassificationBasis` — one or two sentences explaining the Bahrain framing

### Sentiment Keywords

- `sentimentKeywords` — keywords that drove the overall story sentiment rating (no max cap, up to 1000)

### AI Output Normalization (`analyzer.ts`)

The `normalizeReportJson` function handles messy model output before Zod validation:
- Converts confidence from percentage to decimal
- Lowercases sentiment values
- Converts bare strings in string-array fields into single-item arrays
- Filters `bahrainContext` to the six valid enum values
- Normalises `bahrainProminence` casing
- Trims oversized arrays

## F1 GP Study Coding Pipeline

A second, independent pipeline implementing the study's actual content-analysis instrument — **"استمارة تحليل المضمون"** (`استمارة تحليل المضمون.docx`, supplied by the researcher), for the study "أطر المعالجة الإخبارية لجائزة البحرين الكبرى للفورمولا 1 في المواقع الإخبارية الرياضية العالمية وتمثيلاتها للصورة الذهنية عن المملكة." As of 2026-08-26 this replaced an earlier, simpler English-language version of the coding scheme (`Analysis_Guide.md`, now superseded/historical — kept for reference only, not read by any code). The UI is Arabic-only (no EN/AR toggle) to match the form.

Reached via the "استمارة تحليل المضمون" toggle in `app-shell.tsx`. Supports **URL**, **pasted text** (title + body — manual fallback for sites that block scraping), and **CSV batch** input.

### Two-phase draft → save workflow

Unlike the old read-only pipeline, coding is now a review step, not a one-shot AI write:

1. `POST /api/coding/draft` (`src/app/api/coding/draft/route.ts`) takes `{ url }` or `{ pastedTitle, pastedText }` plus `coderName`/`publicationDate`/`year`, extracts the text (`extractFromUrl` or `extractFromPlainText`), runs the Bahrain-mention gate, calls `codeArticle` (`coding-analyzer.ts`) for the AI's field suggestions, and returns a full `CodingDraft` (AI fields + computed fields + identity fields) as JSON. **Nothing is persisted here.**
2. The UI (`coding-workspace.tsx`'s `DraftReviewForm`) renders every field of the draft as an editable form, grouped into the form's 5 محاور (axes), exactly matching `استمارة تحليل المضمون.docx`'s field order and options. The coder can edit anything — including the AI's enum picks, the regex-computed mention counts, and even the extracted title — before saving.
3. `POST /api/coding` (`src/app/api/coding/route.ts`) takes the (possibly edited) draft JSON body, validates it with `codingDraftSchema`, and calls `saveCodedArticle` (`coding-store.ts`) to persist it as the final, immutable row (assigns `articleNumber` sequentially inside a transaction). There is still no `PATCH` — once saved, a row can only be deleted and re-coded, never edited in place.
4. **CSV batch mode is the exception**: `coding-batch-processor.ts` calls `buildCodingDraft` + `saveCodedArticle` back-to-back with no review step, since batch runs are unattended background jobs. `coderName` is left blank for batch-produced rows.

### Site detection is deterministic, not AI-guessed

The form's site list is a fixed, closed set of 5 outlets (ESPN, Sky Sports, Marca, La Gazzetta dello Sport, Fox Sports — **no "Other"**, per the researcher's instrument). `detectSiteFromUrl` (`coding-store.ts`) matches the URL's hostname against each outlet's domain and returns `null` if none match (e.g. pasted text with no URL, or an outlet outside the study's scope) — the coder then picks it manually in the review form. `saveCodedArticle` refuses to save with `site: null`.

### Publication Date and Year are user-entered

Same as before — **never auto-extracted from the article**, even though `extractFromUrl` is capable of it:
- **Single URL/paste mode**: two optional inputs next to the URL/paste fields, sent to `/api/coding/draft`, then carried through (and editable) in the review form.
- **CSV batch**: `src/lib/coding-csv.ts`'s `parseCodingBatchRows` reads them from optional CSV columns 2/3.
- Leaving both blank is fine — the fields just stay empty.

### Fields (matches `استمارة تحليل المضمون.docx` exactly)

The 5 محاور, all in `src/lib/coding-schemas.ts` (enums) and `src/lib/coding-labels.ts` (Arabic labels):

1. **البيانات التعريفية والتوثيقية** — `articleNumber` (auto, sequential), `coderName`, `codingDate`, `site`, `articleTitle`, `url`, `publicationDate`, `year` (2021–2025), `lifeCycle` (`Before`/`During`/`After` — this app's internal values for "قبل السباق بأسبوع"/"أيام السباق الثلاثة"/"بعد السباق بأسبوع"), `articleType` (8 options incl. Interview/Preview/Review/Other + `articleTypeOther`).
2. **بيانات ذكر البحرين** — `bahrainInTitle`, `bahrainInBody` (both booleans, computed via `countBahrainMentions` but coder-editable), `headlineMentions`/`bodyMentions` (editing either live-recomputes `totalMentions` in the UI), `totalMentions` (stored column), `bahrainCentrality` (Peripheral/Moderate/Central).
3. **اتجاهات المعالجة الإعلامية** — `overallTone` (3 options: Positive/Negative/Neutral) and `toneTowardBahrain` (4 options: same 3 + `NotApplicable` for "غير حاضر / غير منطبق" — these are two *different* enums, `OVERALL_TONE_OPTIONS` vs `BAHRAIN_TONE_OPTIONS`, don't conflate them).
4. **فئات السياق والإطار الإخباري والفاعل المحوري** — `dominantContext` (11 options incl. `NotApplicable`), `dominantNewsFrame` (11 options incl. Humanitarian Aspect/Mixed Frame/Other + `newsFrameOther`), `centralActor` (**new field**, not in the old guide — 9 options incl. Other + `centralActorOther`), `dominantImage` (12 options incl. Other/NotApplicable + `imageOther`).
5. **بيانات نوعية توثيقية** — `textExamples` (**new field** — short supporting quotes from the article) and `notes` (single Arabic string now, not bilingual — the UI dropped EN/AR since the form itself is Arabic-only; stored in the `notesAr` column).

### PDF export (print-to-PDF, not jsPDF)

`GET /coding/[id]/print` (`src/app/coding/[id]/print/page.tsx`) is a server-rendered, Arabic RTL page laid out like the original form (labeled rows grouped by axis), with a "حفظ كـ PDF / طباعة" button (`print-button.tsx`) that calls `window.print()`. Styling is in `globals.css` under "Coding form print page" (`.printPage`, `.printAxis`, `.printRow`, plus an `@media print` block with `.noPrint` and `@page { size: A4 }`). This deliberately avoids `jsPDF` — the sentiment pipeline's `export-pdf.ts` has a known, unfixed bug where Helvetica can't shape Arabic glyphs (see `idea.md`); relying on the browser's own text engine sidesteps that entirely for this new PDF. The old pipeline's PDF bug is unrelated and still open.

### CSV export

`GET /api/coding/export` streams a CSV of every coded article ordered by `articleNumber` (columns: article_number, coder_name, coding_date, site, title, url, publication_date, year, life_cycle, article_type, article_type_other, bahrain_in_title, bahrain_in_body, headline_mentions, body_mentions, total_mentions, bahrain_centrality, overall_tone, tone_toward_bahrain, dominant_context, dominant_news_frame, news_frame_other, central_actor, central_actor_other, dominant_image, image_other, text_examples, notes, model, created_at). No pagination.

### Known behaviors

- No duplicate-URL detection in this pipeline (unlike the sentiment pipeline) — re-coding the same URL creates a new row (new `articleNumber`).
- CSV batch rows use the same sequential (not parallel) background runner pattern as the sentiment pipeline's batches, for the same rate-limit reasons.
- `openrouter/auto` (the default model) can take 20–40s per article depending on which underlying model it routes to — this is normal, not a hang; if debugging, check `preview_logs`/network requests before assuming something's broken.

## Schema

Same models in both `prisma/schema.prisma` (MySQL) and `prisma/local/schema.prisma` (SQLite) —
shown once below. The MySQL version additionally annotates long free-text fields
(`extractedText`, `summary`, `url`, `error`, `articleTitle`, `textExamples`, `notesAr`, etc.)
with `@db.Text`/`@db.LongText`, since MySQL's default `VARCHAR(191)` would truncate/reject them;
SQLite has no such limit so its copy needs no annotations.

```prisma
model AnalysisSource {
  id            String          @id @default(cuid())
  sourceType    String          // URL | TEXT | FILE
  title         String?
  url           String?
  publishedAt   DateTime?       // extracted from article HTML (stored but not displayed)
  fileName      String?
  filePath      String?
  mimeType      String?
  language      String
  extractedText String
  createdAt     DateTime        @default(now())
  result        AnalysisResult?
}

model AnalysisResult {
  id           String         @id @default(cuid())
  sourceId     String         @unique
  source       AnalysisSource @relation(fields: [sourceId], references: [id], onDelete: Cascade)
  sentiment    String         // POSITIVE | NEGATIVE | NEUTRAL (story-level)
  confidence   Float
  summary      String
  analysisJson Json           // full AnalysisReport including Bahrain fields
  model        String
  createdAt    DateTime       @default(now())
}
```

`publishedAt` is stored but not displayed in the UI (removed by user request; column retained to avoid migration).

```prisma
model AnalysisBatch {
  id        String              @id @default(cuid())
  fileName  String
  status    String              // RUNNING | DONE
  createdAt DateTime            @default(now())
  items     AnalysisBatchItem[]
}

model AnalysisBatchItem {
  id        String        @id @default(cuid())
  batchId   String
  batch     AnalysisBatch @relation(fields: [batchId], references: [id], onDelete: Cascade)
  url       String
  status    String        // PENDING | SUCCESS | FAILED
  error     String?
  sourceId  String?       // set once analyzed successfully — points at the normal AnalysisSource
  createdAt DateTime      @default(now())
}
```

```prisma
model CodedArticle {
  id                 String    @id @default(cuid())
  articleNumber      Int       @unique // رقم المادة — sequential, assigned at save time
  coderName          String    // اسم المرمز
  codingDate         DateTime  // تاريخ الترميز
  sourceType         String    // URL | CSV | PASTE
  url                String?
  articleTitle       String
  extractedText      String
  site               String
  publicationDate    DateTime?
  year               Int?
  lifeCycle          String    // Before | During | After (المرحلة الزمنية للتغطية)
  articleType        String
  articleTypeOther   String?
  bahrainInTitle     Boolean
  bahrainInBody      Boolean
  headlineMentions   Int
  bodyMentions       Int
  totalMentions      Int
  bahrainCentrality  String
  overallTone        String
  toneTowardBahrain  String
  dominantContext    String
  dominantNewsFrame  String
  newsFrameOther     String?
  centralActor       String
  centralActorOther  String?
  dominantImage      String
  imageOther         String?
  textExamples       String?   // أمثلة دالة من النص
  notesAr            String?   // ملاحظات الباحث/المرمز
  model              String
  createdAt          DateTime  @default(now())
}

model CodingBatch {
  id        String            @id @default(cuid())
  fileName  String
  status    String            // RUNNING | DONE
  createdAt DateTime          @default(now())
  items     CodingBatchItem[]
}

model CodingBatchItem {
  id              String      @id @default(cuid())
  batchId         String
  batch           CodingBatch @relation(fields: [batchId], references: [id], onDelete: Cascade)
  url             String
  publicationDate DateTime?   // user-supplied via CSV column 2 — never auto-extracted
  year            Int?        // user-supplied via CSV column 3
  status          String      // PENDING | SUCCESS | FAILED
  error           String?
  articleId       String?     // set once coded successfully — points at the CodedArticle
  createdAt       DateTime    @default(now())
}
```

`CodedArticle` is a flat table (no separate source/result split like `AnalysisSource`/`AnalysisResult`) since one AI call produces the whole coded record directly. Rows are immutable once created — no `reviewed`/`updatedAt`, no edit endpoint (see "Read-only by design" above).

## CSV Batch Analysis

- Upload flow: `POST /api/batches` reads the CSV, extracts URLs (first column, header row auto-skipped, invalid/blank rows dropped, duplicates removed), creates an `AnalysisBatch` with one `PENDING` `AnalysisBatchItem` per URL, and returns immediately with `{ id }`.
- Processing runs in the background via `after()` (`src/lib/batch-processor.ts`), **sequentially** (not in parallel) to avoid rate-limiting the AI provider or the target sites.
- Each row goes through the exact same pipeline as a single URL analysis (Bahrain gate, two-track sentiment, save via `saveAnalysis`). A row that fails — gate rejection, fetch error, AI error — is marked `FAILED` with an `error` message; it does not stop the rest of the batch.
- Successful rows create a normal `AnalysisSource`/`AnalysisResult` and immediately show up in the regular history list — there's no separate "batch history" view.
- The UI (`research-workspace.tsx`) polls `GET /api/batches/[id]` every 2s while `status === "RUNNING"` and renders a progress panel in place of the analysis panel; closing it or clicking "View" on a finished row returns to the normal single-analysis view.
- CSV upload is capped by `MAX_UPLOAD_MB` (default 20MB) — oversized files are rejected before parsing.
- **Retry — submission failure**: if `POST /api/batches` itself fails (bad file, no valid URLs, etc.), the UI shows the error with a "Retry" button that resubmits the same CSV file (`csvFile` state is kept on error, only cleared on success).
- **Retry — failed rows**: once a batch is `DONE`, a "Retry N failed" button appears in the header if any row is `FAILED`, and each `FAILED` row also has its own amber "Retry" button (`.retryButton`, styled with `--warning` to stand out from the teal "View" button on success rows). Both call `POST /api/batches/[id]/retry` — the header button retries all failed rows, the per-row button passes `{ itemId }` in the request body to retry just that one. The endpoint resets the targeted `FAILED` item(s) back to `PENDING` (clearing `error`) and re-runs the batch. `runBatch` only ever processes `PENDING` items, so already-`SUCCESS` rows (and other still-`FAILED` rows not targeted) are never touched.
- **Row cap**: `MAX_BATCH_ROWS` (default 200) — a CSV with more URLs than that is rejected up front with a clear error, rather than queuing a multi-hour run.

## Duplicate URL Detection

- `findAnalysisByUrl` (`src/lib/analysis-store.ts`) looks up an existing `AnalysisSource` by exact URL match.
- **Single URL** (`/api/analyze`): after extraction resolves the final canonical URL (post-redirects), if a prior analysis exists for that URL the request returns it directly — `{ duplicate: true, analyzedAt, id, sourceId, report }` — skipping the Bahrain gate and the AI call entirely. Pass `force=true` in the form data to bypass this and analyze fresh anyway (creates a new `AnalysisSource`, doesn't overwrite the old one).
- **Batch rows** (`batch-processor.ts`): the same check runs per-row after extraction; a duplicate is marked `SUCCESS` immediately with `sourceId` pointing at the existing analysis, with no AI call. This is why a batch full of already-seen URLs finishes in seconds instead of minutes.
- **UI**: a teal "notice" banner (`.notice`, distinct from the red `.error` banner) shows "Already analyzed on {date} — showing the existing result" with a "Re-analyze anyway" button (`runAnalyze(true)` in `research-workspace.tsx`). The notice clears when the URL field changes or the source-type tab switches.
- Dedup is URL-only — pasted text and file uploads have no natural dedup key and always create a new analysis.

## History Search & Filter

`GET /api/analyses` accepts `?q=<text>` (matches `title` or `url` via SQL `LIKE`, case-insensitive for ASCII on SQLite) and `?sentiment=positive|negative|neutral` (filters on the story-level `AnalysisResult.sentiment` column — Bahrain sentiment isn't filterable since it lives inside the `analysisJson` blob, not a column). The UI's search box and sentiment `<select>` sit above the history list; changing either re-triggers `loadHistory` (its `useCallback` dependencies include the query/sentiment state, so the existing load effect re-fires — no separate debounce logic).

## Security Hardening (`extractors.ts`)

`extractFromUrl` defends against SSRF:
- `redirect: "manual"` — redirects are followed manually (max 5 hops), re-validating the target host on every hop. Fetch's default `redirect: "follow"` would otherwise let a public URL 302 straight to an internal address, bypassing the initial hostname check.
- **DNS resolution check** (`assertPublicHost`): beyond the string-based `isBlockedHostname` check (literal `localhost`/`127.x`/`10.x`/etc.), the hostname is resolved via `dns.lookup` and every returned IP is checked against private/loopback/link-local ranges (`isPrivateIp`). This catches a public-looking domain that resolves to an internal address (e.g. DNS rebinding, or test domains like `localtest.me` which resolve to `127.0.0.1`).
- **Fetch timeout**: 15s `AbortController` timeout so a hanging remote server can't block a request (or, in a batch, hold up the rest of the queue) indefinitely.
- Upload size cap (`MAX_UPLOAD_MB`, default 20MB) applies to both file uploads (`storage.ts`) and CSV batch uploads (`batches/route.ts`).

## UI Structure

```
TopBar
  Logo + heading

Workspace (two-column)
  Left: sourcePanel
    Source type tabs (URL / Text / File / CSV)
    Input field (or CSV dropzone + "Run batch")
    Analyze button
    Error banner (with Retry button for CSV submission failures)
    Duplicate notice (URL mode only, with "Re-analyze anyway")
    History header (search box + sentiment filter dropdown)
    History list
      Each item: [📰 story pill] [🇧🇭 bahrain pill] Title  Date  [trash icon]

  Right: analysisPanel
    (while a CSV batch is active, this panel is replaced by BatchProgress:
     filename, status, success/failed/pending counts, per-row list with
     status icon + "View" (success) or amber "Retry" (failed) button,
     header-level "Retry N failed" + "Close" buttons)

    resultHeader
      URL / filename
      Article title
      scoreTrack
        📰 [POSITIVE/NEGATIVE/NEUTRAL] · XX% confidence (story track only — no separate Bahrain confidence)
        🇧🇭 [POSITIVE/NEGATIVE/NEUTRAL]
      Export PDF button

    Summary section
    Bahrain Analysis card (tinted, accent left border)
      Mentions: Title X times · Body Y times
      Context tags
      Prominence tag
      Framing text
      Keywords
    Classification Basis + story keywords
    Supporting Evidence (quote cards)
    Key Claims + Tone Signals (two-column)
    Source text preview (collapsed)
```

## PDF Export (`export-pdf.ts`)

Client-side only (jsPDF, no server). Key layout techniques:

- **Box rendering**: pre-split text with correct font before measuring, save `boxTop = y`, draw background rect, render content, force `y = boxTop + boxH + gap` after — prevents y-drift causing overflow
- **`checkPage`** is only called before drawing a box, never inside box content rendering
- **Line height**: `size * 0.406` mm (= `size × 1.15 / 2.8346`)

PDF sections: dark header bar → sentiment badges → confidence line → summary → Bahrain analysis box → classification basis → evidence cards → key claims → tone signals → footer with page numbers.

## Known Errors and Fixes

### "Export X was not found in module ..." after renaming a lib export
Not a code bug — Turbopack's dev-mode incremental compilation cache can get stuck referencing an old export name after a rename (seen after renaming `COVERAGE_STAGE_LABELS_AR` → `LIFE_CYCLE_LABELS_AR` in `coding-labels.ts`; the source was already correct on disk, confirmed via `grep`). Fix: stop the dev server, `rm -rf .next`, then `npm run dev` again to force a full recompile.

### Publish-date extraction silently found nothing on many sites (e.g. ESPN)
Root cause: `extractFromUrl` (`extractors.ts`) called `$("script, style, ...").remove()` to clean the article body text **before** calling `extractPublishedDate($, ...)`, which has a JSON-LD (`<script type="application/ld+json">`) lookup step as one of its date sources — so that step always found zero `<script>` tags and silently failed. Confirmed by fetching real pages: ESPN articles only expose their date via JSON-LD (`datePublished`) plus a `DC.date.issued` meta tag that wasn't in the recognized list; a Gazzetta article that "worked" only did so by coincidence, via a `<time datetime>` element (not stripped by that removal call) rather than its own JSON-LD. Fixed by running `extractPublishedDate` before the tag-stripping, and adding `meta[name="DC.date.issued"]` to the recognized selectors. This affects the sentiment pipeline's `publishedAt` too (it uses the same `extractFromUrl`), not just the coding pipeline. Note: the coding pipeline no longer uses this extracted date at all regardless (see "Publication Date and Year are user-entered" above) — this fix mainly restores accuracy for the sentiment pipeline's stored-but-not-displayed `publishedAt`.

### Orphaned upload files on delete
Fixed: `DELETE /api/analyses/[id]` now unlinks `source.filePath` (if set) after removing the DB row. Errors from the unlink (e.g. file already gone) are swallowed — the DB delete is what matters.

### OpenRouter confidence as percentage
Fixed in `normalizeReportJson`: divides by 100 if > 1.

### OpenRouter array too large
Fixed by trimming arrays in `normalizeReportJson`.

### OpenRouter string instead of array
Fixed by wrapping bare strings in a single-item array in `normalizeStringArray`.

### OpenRouter objects in string arrays
Fixed by `objectToReadableString` which extracts a readable string from the object.

### OpenRouter over-nested bilingual fields
After adding bilingual (EN/AR) results, OpenRouter returned a Zod error like `supportingEvidence.en.0.quote: expected string, received object` — the model over-applied the "make everything bilingual" instruction and nested `{en, ar}` a level too deep, inside each evidence item's `quote`/`explanation` (instead of only at the top level of `supportingEvidence`). Fixed in two places in `analyzer.ts`:
- `normalizeEvidenceSide` now coerces each item's `quote`/`explanation` back to a plain string for that language side via `stringifyEvidenceField` (picks `.en`/`.ar` back out if over-nested), dropping any item that ends up empty.
- `normalizeBilingualStringArray` gained `unnestBilingualArrayItem` for the same failure mode in `sentimentKeywords`/`keyClaims`/`toneSignals` items.
- `jsonInstruction` was also reworded to explicitly say the bilingual split happens only at the top level of `supportingEvidence`.

### OpenRouter non-JSON response
`extractJson` tries three patterns (raw object, fenced code block, first/last brace). On failure the error now includes a 200-char preview of what was returned.

### Hydration warning from browser extensions
`suppressHydrationWarning` on root `<html>` in `src/app/layout.tsx`.

### PDF text bleeding out of boxes
Root cause: `splitTextToSize` was called before setting the correct font, so line breaks were computed at the wrong width. Fixed by always calling `font(size, style)` before `splitTextToSize`.

### PDF overlapping boxes
Root cause: y was tracked incrementally through box content, causing drift. Fixed by always setting `y = boxTop + boxH + gap` after each box.

## Testing

Unit tests run on [Vitest](https://vitest.dev) (`vitest.config.ts`, uses Vite's native `resolve.tsconfigPaths` so `@/lib/...` imports resolve — no extra plugin needed). Run with `npm test`.

Coverage is intentionally scoped to pure, deterministic logic — no DB, no network, no AI calls:

- `src/lib/analyzer.test.ts` — `normalizeReportJson` (the messy-AI-output normalizer: percentage confidence, bare-string/array-to-bilingual coercion, per-language array trimming and object-in-array flattening, `bahrainContext`/`bahrainProminence` casing), `extractJson` (raw/fenced/brace-extraction JSON parsing), `countBahrainMentions` (English + localized Bahrain-gate patterns, including a false-positive check).
- `src/lib/schemas.test.ts` — `resolveReportLanguage` (resolves `en`/`ar` from a bilingual report, passes legacy flat-shaped reports through unchanged) and `isBilingualReport`.
- `src/lib/csv.test.ts` — `parseUrlsFromCsv` (header skip, blank lines, non-URL rows, extra columns, quoted fields, dedup, CRLF).
- `src/lib/language.test.ts` — `detectLanguage` (en/es/it/ar) and `textDirection`.
- `src/lib/extractors.test.ts` — `normalizeText`, `truncateForAnalysis`, and the SSRF helpers `isBlockedHostname`/`isPrivateIp` (private IPv4/IPv6 ranges, cloud metadata address, public addresses correctly allowed).
- `src/lib/coding-analyzer.test.ts` — `classifyLifeCycle` (before/during/after the Bahrain GP race weekend across all configured years, out-of-window and unknown-year fallbacks) and `normalizeCodingJson` (case-insensitive enum matching, safe fallback for unrecognized values, blank-vs-populated optional free text, the `NotApplicable` Bahrain-tone-only option, plain Arabic `notes` string trimming — `notes` is a single string now, not bilingual).
- `src/lib/coding-csv.test.ts` — `parseCodingBatchRows` (URL-only rows, optional publication-date/year columns, malformed date/year handling, header skip, dedup, quoted URL fields, blank-line skipping).

`normalizeReportJson`, `extractJson`, `isBlockedHostname`, and `isPrivateIp` were module-private before this — they're exported now specifically so they're testable; nothing about their behavior changed.

Not covered (would need mocking/integration infra disproportionate to this app's size): API routes, Prisma-backed code (`analysis-store.ts`, `batch-processor.ts`, `coding-store.ts`, `coding-batch-processor.ts`), the OpenAI/OpenRouter calls in `analyzer.ts`/`coding-analyzer.ts`, `extractFromUrl`'s network path, and the client-only `export-pdf.ts`.

The F1 GP Study Coding pipeline's draft → review → save flow was manually smoke-tested end-to-end through the actual browser UI on 2026-08-26 (pasted-text mode, real OpenRouter call, full field review, save, history list, CSV export, print page) right after the `استمارة تحليل المضمون.docx` rework. If re-verifying after further changes, prefer testing through the UI in a browser over bypassing it with scripts — the draft/review step is exactly the part a script would skip.

## Resume Checklist

1. Read this file.
2. Start dev server: `npm run dev` (this already runs `prisma generate --schema=prisma/local/schema.prisma` first)
3. If the local SQLite database is missing: `npm run prisma:migrate:local -- --name init`
4. Verify: `npm run typecheck && npm run lint && npm test`

## Known Notes

- `logo.png` exists at project root and as `public/logo.png`; app uses `public/logo.png`
- `.env.local` contains the OpenRouter key — keep private
- `uploads/` is git-ignored
- `prisma/local/dev.db` is the local database file (git-ignored) — production uses MySQL instead, see "Runtime Configuration" and `DEPLOY.md`
- Production's `CodedArticle` table (MySQL) started empty as of the 2026-08-26 SQLite→MySQL migration — no data was carried over (there was none on the live site yet). The researcher's local SQLite data (`prisma/local/dev.db`) is untouched and separate.
- Scanned PDF OCR is not implemented
- `publishedAt` column exists in DB and is still extracted and saved, but not shown in UI
- The `allowedDevOrigins: ["10.2.3.44"]` in `next.config.ts` allows access from the local network device at that IP
- The F1 GP Study Coding pipeline's `RACE_WEEKENDS` table (`coding-analyzer.ts`) is a manually-maintained reference of official Bahrain GP dates for 2021–2025 — verify against the official F1 calendar if a `lifeCycle` value looks wrong. Rows are still immutable once saved — no `PATCH` — but a bad `lifeCycle` can now be caught and fixed by the coder during the draft-review step, before saving, instead of only via delete-and-recode after.
- **After running a Prisma migration, restart the dev server** (`Ctrl+C` then `npm run dev`, and `rm -rf .next` too if you also hit the stale-export error above). `src/lib/prisma.ts` caches the `PrismaClient` instance on `globalThis` across hot-reloads (the standard Next.js dev pattern, to avoid exhausting DB connections) — a running server keeps using the client from when it started, so it won't see new columns/tables until restarted.
- The `CodedArticle` table was migrated to the new `استمارة تحليل المضمون.docx` schema on 2026-08-26 (migration `20260826120404_coding_form_v2`). At that point the table held exactly one leftover test row (a Gazzetta test-testing article from earlier development, not real study data) — it was deleted before migrating since the new required columns (`articleNumber`, `coderName`, `codingDate`, `totalMentions`, `bahrainInBody`, `centralActor`) have no sensible default for pre-existing rows. **The table is empty as of this migration** — the researcher's real coded dataset starts fresh from here. Any future schema change here should preserve real rows by that point (hand-write the migration) rather than following this precedent.
