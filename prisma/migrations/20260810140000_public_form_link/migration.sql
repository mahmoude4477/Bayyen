-- One public assessment link per analysis, with named student slots.
ALTER TABLE "AnalysisSession" ADD COLUMN "formToken" TEXT;
UPDATE "AnalysisSession" SET "formToken" = 'public-' || "id";
ALTER TABLE "AnalysisSession" ALTER COLUMN "formToken" SET NOT NULL;

ALTER TABLE "Student" ADD COLUMN "name" TEXT;
ALTER TABLE "Student" ADD COLUMN "nameKey" TEXT;

CREATE UNIQUE INDEX "AnalysisSession_formToken_key" ON "AnalysisSession"("formToken");
CREATE UNIQUE INDEX "Student_sessionId_nameKey_key" ON "Student"("sessionId", "nameKey");
