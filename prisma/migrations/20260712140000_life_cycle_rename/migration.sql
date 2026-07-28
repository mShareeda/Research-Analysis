-- "Coverage Stage" is renamed to "Life Cycle" with simplified values
-- (Before / During / After instead of the guide's original long-form phrases),
-- at the user's request. Existing rows' values are remapped, not dropped.

ALTER TABLE "CodedArticle" RENAME COLUMN "coverageStage" TO "lifeCycle";

UPDATE "CodedArticle" SET "lifeCycle" = CASE "lifeCycle"
  WHEN 'One week before the race' THEN 'Before'
  WHEN 'During the three race days' THEN 'During'
  WHEN 'One week after the race' THEN 'After'
  ELSE "lifeCycle"
END;
