-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Course" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
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
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Course" ("contextDoc", "createdAt", "description", "difficulty", "focusAreas", "id", "language", "status", "targetLessonCount", "title", "topic", "updatedAt") SELECT "contextDoc", "createdAt", "description", "difficulty", "focusAreas", "id", "language", "status", "targetLessonCount", "title", "topic", "updatedAt" FROM "Course";
DROP TABLE "Course";
ALTER TABLE "new_Course" RENAME TO "Course";
CREATE TABLE "new_Lesson" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "courseId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "contentJson" TEXT,
    "rawMarkdown" TEXT,
    "generationPrompt" TEXT,
    "isSupplementary" BOOLEAN NOT NULL DEFAULT false,
    "weight" REAL NOT NULL DEFAULT 1.0,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Lesson_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Lesson" ("completedAt", "contentJson", "courseId", "createdAt", "generationPrompt", "id", "isSupplementary", "orderIndex", "rawMarkdown", "status", "summary", "title", "updatedAt") SELECT "completedAt", "contentJson", "courseId", "createdAt", "generationPrompt", "id", "isSupplementary", "orderIndex", "rawMarkdown", "status", "summary", "title", "updatedAt" FROM "Lesson";
DROP TABLE "Lesson";
ALTER TABLE "new_Lesson" RENAME TO "Lesson";
CREATE INDEX "Lesson_courseId_idx" ON "Lesson"("courseId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
