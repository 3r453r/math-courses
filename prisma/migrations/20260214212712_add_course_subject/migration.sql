-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Course" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "subject" TEXT NOT NULL DEFAULT 'Other',
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
INSERT INTO "new_Course" ("clonedFromId", "contextDoc", "createdAt", "description", "difficulty", "focusAreas", "id", "language", "lessonFailureThreshold", "noLessonCanFail", "passThreshold", "status", "targetLessonCount", "title", "topic", "updatedAt", "userId") SELECT "clonedFromId", "contextDoc", "createdAt", "description", "difficulty", "focusAreas", "id", "language", "lessonFailureThreshold", "noLessonCanFail", "passThreshold", "status", "targetLessonCount", "title", "topic", "updatedAt", "userId" FROM "Course";
DROP TABLE "Course";
ALTER TABLE "new_Course" RENAME TO "Course";
CREATE INDEX "Course_userId_idx" ON "Course"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
