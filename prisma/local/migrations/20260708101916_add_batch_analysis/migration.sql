-- CreateTable
CREATE TABLE "AnalysisBatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fileName" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "AnalysisBatchItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "batchId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "sourceId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AnalysisBatchItem_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "AnalysisBatch" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
