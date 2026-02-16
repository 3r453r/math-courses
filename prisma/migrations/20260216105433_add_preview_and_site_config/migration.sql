-- AlterTable
ALTER TABLE "CourseShare" ADD COLUMN "previewLessonId" TEXT;

-- CreateTable
CREATE TABLE "SiteConfig" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL
);
