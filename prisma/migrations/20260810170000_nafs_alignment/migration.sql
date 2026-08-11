ALTER TABLE "AnalysisSession"
ADD COLUMN "nafsAligned" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "nafsDomain" TEXT,
ADD COLUMN "nafsFramework" TEXT;

UPDATE "AnalysisSession"
SET
  "subject" = 'العلوم',
  "nafsAligned" = true,
  "nafsDomain" = 'العلوم الفيزيائية · القوى والحركة والطاقة',
  "nafsFramework" = 'إطار نافس الوطني 2024'
WHERE
  ("subject" IN ('فيزياء', 'الفيزياء'))
  AND (
    "grade" LIKE '%السادس%'
    OR "grade" LIKE '% 6%'
    OR "grade" LIKE '%٦%'
  );
