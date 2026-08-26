-- CreateTable
CREATE TABLE `AnalysisSource` (
    `id` VARCHAR(191) NOT NULL,
    `sourceType` VARCHAR(191) NOT NULL,
    `title` TEXT NULL,
    `url` TEXT NULL,
    `publishedAt` DATETIME(3) NULL,
    `fileName` VARCHAR(191) NULL,
    `filePath` VARCHAR(191) NULL,
    `mimeType` VARCHAR(191) NULL,
    `language` VARCHAR(191) NOT NULL,
    `extractedText` LONGTEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AnalysisResult` (
    `id` VARCHAR(191) NOT NULL,
    `sourceId` VARCHAR(191) NOT NULL,
    `sentiment` VARCHAR(191) NOT NULL,
    `confidence` DOUBLE NOT NULL,
    `summary` TEXT NOT NULL,
    `analysisJson` JSON NOT NULL,
    `model` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `AnalysisResult_sourceId_key`(`sourceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AnalysisBatch` (
    `id` VARCHAR(191) NOT NULL,
    `fileName` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AnalysisBatchItem` (
    `id` VARCHAR(191) NOT NULL,
    `batchId` VARCHAR(191) NOT NULL,
    `url` TEXT NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `error` TEXT NULL,
    `sourceId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CodedArticle` (
    `id` VARCHAR(191) NOT NULL,
    `articleNumber` INTEGER NOT NULL,
    `coderName` VARCHAR(191) NOT NULL,
    `codingDate` DATETIME(3) NOT NULL,
    `sourceType` VARCHAR(191) NOT NULL,
    `url` TEXT NULL,
    `articleTitle` TEXT NOT NULL,
    `extractedText` LONGTEXT NOT NULL,
    `site` VARCHAR(191) NOT NULL,
    `publicationDate` DATETIME(3) NULL,
    `year` INTEGER NULL,
    `lifeCycle` VARCHAR(191) NOT NULL,
    `articleType` VARCHAR(191) NOT NULL,
    `articleTypeOther` VARCHAR(191) NULL,
    `bahrainInTitle` BOOLEAN NOT NULL,
    `bahrainInBody` BOOLEAN NOT NULL,
    `headlineMentions` INTEGER NOT NULL,
    `bodyMentions` INTEGER NOT NULL,
    `totalMentions` INTEGER NOT NULL,
    `bahrainCentrality` VARCHAR(191) NOT NULL,
    `overallTone` VARCHAR(191) NOT NULL,
    `toneTowardBahrain` VARCHAR(191) NOT NULL,
    `dominantContext` VARCHAR(191) NOT NULL,
    `dominantNewsFrame` VARCHAR(191) NOT NULL,
    `newsFrameOther` VARCHAR(191) NULL,
    `centralActor` VARCHAR(191) NOT NULL,
    `centralActorOther` VARCHAR(191) NULL,
    `dominantImage` VARCHAR(191) NOT NULL,
    `imageOther` VARCHAR(191) NULL,
    `textExamples` TEXT NULL,
    `notesAr` TEXT NULL,
    `model` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `CodedArticle_articleNumber_key`(`articleNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CodingBatch` (
    `id` VARCHAR(191) NOT NULL,
    `fileName` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CodingBatchItem` (
    `id` VARCHAR(191) NOT NULL,
    `batchId` VARCHAR(191) NOT NULL,
    `url` TEXT NOT NULL,
    `publicationDate` DATETIME(3) NULL,
    `year` INTEGER NULL,
    `status` VARCHAR(191) NOT NULL,
    `error` TEXT NULL,
    `articleId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `AnalysisResult` ADD CONSTRAINT `AnalysisResult_sourceId_fkey` FOREIGN KEY (`sourceId`) REFERENCES `AnalysisSource`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AnalysisBatchItem` ADD CONSTRAINT `AnalysisBatchItem_batchId_fkey` FOREIGN KEY (`batchId`) REFERENCES `AnalysisBatch`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CodingBatchItem` ADD CONSTRAINT `CodingBatchItem_batchId_fkey` FOREIGN KEY (`batchId`) REFERENCES `CodingBatch`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

