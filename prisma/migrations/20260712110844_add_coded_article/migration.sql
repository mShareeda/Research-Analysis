-- CreateTable
CREATE TABLE "CodedArticle" (
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
    "notes" TEXT,
    "reviewed" BOOLEAN NOT NULL DEFAULT false,
    "model" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CodingBatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fileName" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "CodingBatchItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "batchId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "articleId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CodingBatchItem_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "CodingBatch" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
