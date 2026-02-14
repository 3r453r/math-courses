-- AlterTable
ALTER TABLE "Course" ADD COLUMN "clonedFromId" TEXT;

-- CreateTable
CREATE TABLE "CourseShare" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "courseId" TEXT NOT NULL,
    "shareToken" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CourseShare_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "CourseShare_shareToken_key" ON "CourseShare"("shareToken");

-- CreateIndex
CREATE INDEX "CourseShare_courseId_idx" ON "CourseShare"("courseId");
