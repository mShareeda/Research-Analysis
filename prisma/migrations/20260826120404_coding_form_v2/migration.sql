/*
  Warnings:

  - You are about to drop the column `notesEn` on the `CodedArticle` table. All the data in the column will be lost.
  - You are about to drop the column `siteOther` on the `CodedArticle` table. All the data in the column will be lost.
  - Added the required column `articleNumber` to the `CodedArticle` table without a default value. This is not possible if the table is not empty.
  - Added the required column `bahrainInBody` to the `CodedArticle` table without a default value. This is not possible if the table is not empty.
  - Added the required column `centralActor` to the `CodedArticle` table without a default value. This is not possible if the table is not empty.
  - Added the required column `coderName` to the `CodedArticle` table without a default value. This is not possible if the table is not empty.
  - Added the required column `codingDate` to the `CodedArticle` table without a default value. This is not possible if the table is not empty.
  - Added the required column `totalMentions` to the `CodedArticle` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CodedArticle" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "articleNumber" INTEGER NOT NULL,
    "coderName" TEXT NOT NULL,
    "codingDate" DATETIME NOT NULL,
    "sourceType" TEXT NOT NULL,
    "url" TEXT,
    "articleTitle" TEXT NOT NULL,
    "extractedText" TEXT NOT NULL,
    "site" TEXT NOT NULL,
    "publicationDate" DATETIME,
    "year" INTEGER,
    "lifeCycle" TEXT NOT NULL,
    "articleType" TEXT NOT NULL,
    "articleTypeOther" TEXT,
    "bahrainInTitle" BOOLEAN NOT NULL,
    "bahrainInBody" BOOLEAN NOT NULL,
    "headlineMentions" INTEGER NOT NULL,
    "bodyMentions" INTEGER NOT NULL,
    "totalMentions" INTEGER NOT NULL,
    "bahrainCentrality" TEXT NOT NULL,
    "overallTone" TEXT NOT NULL,
    "toneTowardBahrain" TEXT NOT NULL,
    "dominantContext" TEXT NOT NULL,
    "dominantNewsFrame" TEXT NOT NULL,
    "newsFrameOther" TEXT,
    "centralActor" TEXT NOT NULL,
    "centralActorOther" TEXT,
    "dominantImage" TEXT NOT NULL,
    "imageOther" TEXT,
    "textExamples" TEXT,
    "notesAr" TEXT,
    "model" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_CodedArticle" ("articleTitle", "articleType", "bahrainCentrality", "bahrainInTitle", "bodyMentions", "createdAt", "dominantContext", "dominantImage", "dominantNewsFrame", "extractedText", "headlineMentions", "id", "imageOther", "lifeCycle", "model", "newsFrameOther", "notesAr", "overallTone", "publicationDate", "site", "sourceType", "toneTowardBahrain", "url", "year") SELECT "articleTitle", "articleType", "bahrainCentrality", "bahrainInTitle", "bodyMentions", "createdAt", "dominantContext", "dominantImage", "dominantNewsFrame", "extractedText", "headlineMentions", "id", "imageOther", "lifeCycle", "model", "newsFrameOther", "notesAr", "overallTone", "publicationDate", "site", "sourceType", "toneTowardBahrain", "url", "year" FROM "CodedArticle";
DROP TABLE "CodedArticle";
ALTER TABLE "new_CodedArticle" RENAME TO "CodedArticle";
CREATE UNIQUE INDEX "CodedArticle_articleNumber_key" ON "CodedArticle"("articleNumber");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
