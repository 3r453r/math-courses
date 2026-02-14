-- AlterTable
ALTER TABLE "Lesson" ADD COLUMN "completedAt" DATETIME;

-- CreateTable
CREATE TABLE "CourseCompletionSummary" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "courseId" TEXT NOT NULL,
    "summaryJson" TEXT NOT NULL,
    "narrativeMarkdown" TEXT,
    "recommendationJson" TEXT,
    "completedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CourseCompletionSummary_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Quiz" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "lessonId" TEXT NOT NULL,
    "questionsJson" TEXT NOT NULL,
    "questionCount" INTEGER NOT NULL DEFAULT 15,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "generation" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Quiz_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Quiz" ("createdAt", "id", "lessonId", "questionCount", "questionsJson", "status") SELECT "createdAt", "id", "lessonId", "questionCount", "questionsJson", "status" FROM "Quiz";
DROP TABLE "Quiz";
ALTER TABLE "new_Quiz" RENAME TO "Quiz";
CREATE INDEX "Quiz_lessonId_idx" ON "Quiz"("lessonId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "CourseCompletionSummary_courseId_key" ON "CourseCompletionSummary"("courseId");
