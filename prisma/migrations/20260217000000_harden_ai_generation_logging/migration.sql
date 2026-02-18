ALTER TABLE "AiGenerationLog" ADD COLUMN "rawOutputRedacted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "AiGenerationLog" ADD COLUMN "promptRedacted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "AiGenerationLog" ADD COLUMN "sensitiveTextExpiresAt" DATETIME;
ALTER TABLE "AiGenerationLog" ADD COLUMN "sensitiveTextRedactedAt" DATETIME;

CREATE INDEX "AiGenerationLog_sensitiveTextExpiresAt_idx" ON "AiGenerationLog"("sensitiveTextExpiresAt");
