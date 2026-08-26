# Research Analysis

Personal research analysis app for URLs, pasted text, PDFs, DOCX, TXT, and Markdown files.

The app extracts readable content, sends it to OpenRouter or OpenAI for structured sentiment analysis, and saves the source plus report in a local SQLite database.

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create `.env.local` from `.env.example`. Keep `.env` with `DATABASE_URL="file:./dev.db"` for Prisma. The default provider is OpenRouter:

   ```bash
   AI_PROVIDER="openrouter"
   OPENROUTER_API_KEY="sk-or-v1-your-key"
   OPENROUTER_MODEL="openrouter/auto"
   ```

   To use OpenAI directly instead, set `AI_PROVIDER="openai"` and `OPENAI_API_KEY`.

3. Create the local SQLite database:

   ```bash
   npm run prisma:migrate -- --name init
   ```

4. Start the app:

   ```bash
   npm run dev
   ```

Open `http://localhost:3000`.

## Supported Inputs

- Article/story URLs that return readable HTML
- Pasted text
- PDF files with embedded text
- DOCX files
- TXT, Markdown, and `.md` files

Scanned PDF OCR is intentionally not included in v1.

## Content-Analysis Coding (استمارة تحليل المضمون)

A second mode ("استمارة تحليل المضمون" toggle) codes Bahrain F1 Grand Prix articles against
the researcher's own content-analysis form — URL, pasted text, or CSV batch input, an
AI-generated draft the coder reviews and edits before saving, CSV export of the full dataset,
and a print-to-PDF export per article matching the original form's layout. See `HANDOFF.md`
("F1 GP Study Coding Pipeline" section) for the full design.

## Deploying

See `DEPLOY.md` for deploying this app to a Hostinger VPS/Node.js hosting plan under a
subdomain.

## Verification

```bash
npm run typecheck
npm run lint
npm audit --omit=dev
npm run build
```
