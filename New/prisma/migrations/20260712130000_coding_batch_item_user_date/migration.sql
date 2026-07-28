-- Publication Date and Year are now entered by the user (single-URL form field,
-- or CSV columns 2/3) instead of being auto-extracted from the article. Batch
-- items need to carry these per-row so a later retry still has them.

ALTER TABLE "CodingBatchItem" ADD COLUMN "publicationDate" DATETIME;
ALTER TABLE "CodingBatchItem" ADD COLUMN "year" INTEGER;
