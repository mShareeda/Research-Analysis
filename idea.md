# Improvement Ideas

Running list of proposed improvements. Check an item off (and add a one-line note on how it was done) once it's actually implemented.

- [ ] **Fix Arabic rendering in PDF export** — jsPDF + Helvetica can't shape Arabic glyphs, so exporting the Arabic tab produces broken text. Embed a proper Arabic-capable TTF (e.g. Noto Sans Arabic) via jsPDF's `addFont`/`addFileToVFS` and mirror text alignment for RTL sections.

- [ ] **Add a "Translate" button for legacy (pre-bilingual) history items** — old analyses have no language tab. A cheap translation-only AI call (no re-analysis, just translate existing text fields into the missing language and merge into `{en, ar}`) would let users retrofit old history instead of it staying stuck in one language.

- [ ] **Make batch retries handle rate-limiting automatically** — `runBatch` (`src/lib/batch-processor.ts`) marks a row `FAILED` on any error, including a 429 from the AI provider, requiring a manual retry click. Add exponential backoff + retry-on-429 inside `runBatch` itself — more important now that bilingual responses are bigger/slower per call, increasing throttling risk.

- [ ] **Make Bahrain sentiment/context/prominence filterable in history**, not just story sentiment. Given the app is Bahrain-monitoring-focused, "show me all negative-toward-Bahrain stories" is probably more useful than story-level sentiment, but those fields live inside the `analysisJson` blob, not a queryable column. Would need promoting `bahrainSentiment` to its own `AnalysisResult` column (small migration) plus a UI filter dropdown next to the existing one.
