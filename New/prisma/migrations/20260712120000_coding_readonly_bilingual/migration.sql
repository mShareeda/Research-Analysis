-- Coding pipeline is now read-only after AI creation (no more edit endpoint),
-- so `reviewed`/`updatedAt` are dropped, and `notes` becomes bilingual
-- (notesEn/notesAr) to support the Arabic result tab.
-- Existing `notes` values are preserved into `notesEn`; there is no prior
-- Arabic translation to backfill, so `notesAr` starts NULL for old rows.

PRAGMA foreign_keys=OFF;

CREATE TABLE "new_CodedArticle" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceType" TEXT NOT NULL,
    "url" TEXT,
    "articleTitle" TEXT NOT NULL,
    "extractedText" TEXT NOT NULL,
    "site" TEXT NOT NULL,
    "siteOther" TEXT,
    "publicationDate" DATETIME,
    "year" INTEGER,
    "coverageStage" TEXT NOT NULL,
    "articleType" TEXT NOT NULL,
    "bahrainInTitle" BOOLEAN NOT NULL,
    "headlineMentions" INTEGER NOT NULL,
    "bodyMentions" INTEGER NOT NULL,
    "bahrainCentrality" TEXT NOT NULL,
    "overallTone" TEXT NOT NULL,
    "toneTowardBahrain" TEXT NOT NULL,
    "dominantContext" TEXT NOT NULL,
    "dominantNewsFrame" TEXT NOT NULL,
    "newsFrameOther" TEXT,
    "dominantImage" TEXT NOT NULL,
    "imageOther" TEXT,
    "notesEn" TEXT,
    "notesAr" TEXT,
    "model" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO "new_CodedArticle" (
    "id", "sourceType", "url", "articleTitle", "extractedText", "site", "siteOther",
    "publicationDate", "year", "coverageStage", "articleType", "bahrainInTitle",
    "headlineMentions", "bodyMentions", "bahrainCentrality", "overallTone",
    "toneTowardBahrain", "dominantContext", "dominantNewsFrame", "newsFrameOther",
    "dominantImage", "imageOther", "notesEn", "notesAr", "model", "createdAt"
)
SELECT
    "id", "sourceType", "url", "articleTitle", "extractedText", "site", "siteOther",
    "publicationDate", "year", "coverageStage", "articleType", "bahrainInTitle",
    "headlineMentions", "bodyMentions", "bahrainCentrality", "overallTone",
    "toneTowardBahrain", "dominantContext", "dominantNewsFrame", "newsFrameOther",
    "dominantImage", "imageOther", "notes", NULL, "model", "createdAt"
FROM "CodedArticle";

DROP TABLE "CodedArticle";
ALTER TABLE "new_CodedArticle" RENAME TO "CodedArticle";

PRAGMA foreign_keys=ON;
