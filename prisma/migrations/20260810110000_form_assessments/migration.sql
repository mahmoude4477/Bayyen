-- CreateEnum
CREATE TYPE "AnalysisInputMode" AS ENUM ('FORM', 'PDF');

-- AlterEnum
ALTER TYPE "QuestionType" ADD VALUE 'INK';

-- AlterTable
ALTER TABLE "AnalysisSession" ADD COLUMN "inputMode" "AnalysisInputMode" NOT NULL DEFAULT 'FORM',
ADD COLUMN "publishedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Student" ADD COLUMN "formToken" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "FormSubmission" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FormSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FormSubmission_studentId_key" ON "FormSubmission"("studentId");

-- CreateIndex
CREATE INDEX "FormSubmission_sessionId_submittedAt_idx" ON "FormSubmission"("sessionId", "submittedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Student_formToken_key" ON "Student"("formToken");

-- AddForeignKey
ALTER TABLE "FormSubmission" ADD CONSTRAINT "FormSubmission_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AnalysisSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormSubmission" ADD CONSTRAINT "FormSubmission_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
