-- Remove unused fixed student slots from form assessments. Named/submitted students remain intact.
DELETE FROM "Student" AS student
WHERE student."name" IS NULL
  AND EXISTS (
    SELECT 1 FROM "AnalysisSession" AS session
    WHERE session."id" = student."sessionId" AND session."inputMode" = 'FORM'
  )
  AND NOT EXISTS (SELECT 1 FROM "SubmissionAsset" AS asset WHERE asset."studentId" = student."id")
  AND NOT EXISTS (SELECT 1 FROM "FormSubmission" AS submission WHERE submission."studentId" = student."id")
  AND NOT EXISTS (SELECT 1 FROM "AnswerResult" AS result WHERE result."studentId" = student."id");
