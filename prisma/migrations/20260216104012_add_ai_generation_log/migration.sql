-- CreateTable
CREATE TABLE "AiGenerationLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "generationType" TEXT NOT NULL,
    "schemaName" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "userId" TEXT,
    "courseId" TEXT,
    "lessonId" TEXT,
    "outcome" TEXT NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "layer0Called" BOOLEAN NOT NULL DEFAULT false,
    "layer0Result" TEXT,
    "layer0Error" TEXT,
    "layer1Called" BOOLEAN NOT NULL DEFAULT false,
    "layer1Success" BOOLEAN NOT NULL DEFAULT false,
    "layer1HadWrapper" BOOLEAN NOT NULL DEFAULT false,
    "layer2Called" BOOLEAN NOT NULL DEFAULT false,
    "layer2Success" BOOLEAN NOT NULL DEFAULT false,
    "layer2ModelId" TEXT,
    "rawOutputText" TEXT,
    "rawOutputLen" INTEGER,
    "zodErrors" TEXT,
    "errorMessage" TEXT,
    "promptHash" TEXT,
    "promptText" TEXT,
    "language" TEXT,
    "difficulty" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Course" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "subject" TEXT NOT NULL DEFAULT '["Other"]',
    "focusAreas" TEXT NOT NULL DEFAULT '[]',
    "targetLessonCount" INTEGER NOT NULL DEFAULT 10,
    "difficulty" TEXT NOT NULL DEFAULT 'intermediate',
    "language" TEXT NOT NULL DEFAULT 'en',
    "contextDoc" TEXT,
    "passThreshold" REAL NOT NULL DEFAULT 0.8,
    "noLessonCanFail" BOOLEAN NOT NULL DEFAULT true,
    "lessonFailureThreshold" REAL NOT NULL DEFAULT 0.5,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "clonedFromId" TEXT,
    CONSTRAINT "Course_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Course" ("clonedFromId", "contextDoc", "createdAt", "description", "difficulty", "focusAreas", "id", "language", "lessonFailureThreshold", "noLessonCanFail", "passThreshold", "status", "subject", "targetLessonCount", "title", "topic", "updatedAt", "userId") SELECT "clonedFromId", "contextDoc", "createdAt", "description", "difficulty", "focusAreas", "id", "language", "lessonFailureThreshold", "noLessonCanFail", "passThreshold", "status", "subject", "targetLessonCount", "title", "topic", "updatedAt", "userId" FROM "Course";
DROP TABLE "Course";
ALTER TABLE "new_Course" RENAME TO "Course";
CREATE INDEX "Course_userId_idx" ON "Course"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "AiGenerationLog_generationType_idx" ON "AiGenerationLog"("generationType");

-- CreateIndex
CREATE INDEX "AiGenerationLog_outcome_idx" ON "AiGenerationLog"("outcome");

-- CreateIndex
CREATE INDEX "AiGenerationLog_modelId_idx" ON "AiGenerationLog"("modelId");

-- CreateIndex
CREATE INDEX "AiGenerationLog_createdAt_idx" ON "AiGenerationLog"("createdAt");

-- CreateIndex
CREATE INDEX "AiGenerationLog_courseId_idx" ON "AiGenerationLog"("courseId");
