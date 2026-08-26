-- CreateTable
CREATE TABLE "AnalysisSource" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceType" TEXT NOT NULL,
    "title" TEXT,
    "url" TEXT,
    "fileName" TEXT,
    "filePath" TEXT,
    "mimeType" TEXT,
    "language" TEXT NOT NULL,
    "extractedText" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "AnalysisResult" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceId" TEXT NOT NULL,
    "sentiment" TEXT NOT NULL,
    "confidence" REAL NOT NULL,
    "summary" TEXT NOT NULL,
    "analysisJson" JSONB NOT NULL,
    "model" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AnalysisResult_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "AnalysisSource" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "AnalysisResult_sourceId_key" ON "AnalysisResult"("sourceId");
