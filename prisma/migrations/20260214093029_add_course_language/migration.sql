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
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Course" ("contextDoc", "createdAt", "description", "difficulty", "focusAreas", "id", "status", "targetLessonCount", "title", "topic", "updatedAt") SELECT "contextDoc", "createdAt", "description", "difficulty", "focusAreas", "id", "status", "targetLessonCount", "title", "topic", "updatedAt" FROM "Course";
DROP TABLE "Course";
ALTER TABLE "new_Course" RENAME TO "Course";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
