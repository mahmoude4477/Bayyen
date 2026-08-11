UPDATE "AnalysisSession" AS session
SET "status" = 'READY'
WHERE session."inputMode" = 'FORM'
  AND session."status" = 'DRAFT'
  AND EXISTS (SELECT 1 FROM "FormSubmission" AS submission WHERE submission."sessionId" = session."id");
