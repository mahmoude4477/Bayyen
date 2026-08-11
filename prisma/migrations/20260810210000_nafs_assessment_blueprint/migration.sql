ALTER TABLE "AnalysisSession"
ALTER COLUMN "lesson" DROP NOT NULL;

ALTER TABLE "Question"
ADD COLUMN "choices" JSONB;

UPDATE "AnalysisSession"
SET
  "nafsAligned" = true,
  "nafsDomain" = 'العلوم الطبيعية · الصف السادس',
  "nafsFramework" = 'وثيقة نواتج التعلم للاختبارات الوطنية 2026'
WHERE "nafsAligned" = true;
