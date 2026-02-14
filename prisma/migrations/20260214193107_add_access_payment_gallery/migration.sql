-- CreateTable
CREATE TABLE "AccessCode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'general',
    "maxUses" INTEGER NOT NULL DEFAULT 1,
    "currentUses" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" DATETIME,
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AccessCode_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AccessCodeRedemption" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accessCodeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "redeemedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AccessCodeRedemption_accessCodeId_fkey" FOREIGN KEY ("accessCodeId") REFERENCES "AccessCode" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AccessCodeRedemption_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CourseRating" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "courseShareId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CourseRating_courseShareId_fkey" FOREIGN KEY ("courseShareId") REFERENCES "CourseShare" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CourseRating_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "stripeSessionId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "accessCodeId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Payment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CourseShare" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "courseId" TEXT NOT NULL,
    "shareToken" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isGalleryListed" BOOLEAN NOT NULL DEFAULT false,
    "galleryTitle" TEXT,
    "galleryDescription" TEXT,
    "tags" TEXT NOT NULL DEFAULT '[]',
    "starCount" INTEGER NOT NULL DEFAULT 0,
    "cloneCount" INTEGER NOT NULL DEFAULT 0,
    "featuredAt" DATETIME,
    CONSTRAINT "CourseShare_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_CourseShare" ("courseId", "createdAt", "expiresAt", "id", "isActive", "shareToken") SELECT "courseId", "createdAt", "expiresAt", "id", "isActive", "shareToken" FROM "CourseShare";
DROP TABLE "CourseShare";
ALTER TABLE "new_CourseShare" RENAME TO "CourseShare";
CREATE UNIQUE INDEX "CourseShare_shareToken_key" ON "CourseShare"("shareToken");
CREATE INDEX "CourseShare_courseId_idx" ON "CourseShare"("courseId");
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT,
    "email" TEXT,
    "emailVerified" DATETIME,
    "image" TEXT,
    "encryptedApiKey" TEXT,
    "apiKeyIv" TEXT,
    "role" TEXT NOT NULL DEFAULT 'user',
    "accessStatus" TEXT NOT NULL DEFAULT 'pending',
    "accessGrantedAt" DATETIME,
    "accessSource" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_User" ("apiKeyIv", "createdAt", "email", "emailVerified", "encryptedApiKey", "id", "image", "name", "updatedAt") SELECT "apiKeyIv", "createdAt", "email", "emailVerified", "encryptedApiKey", "id", "image", "name", "updatedAt" FROM "User";
-- Set existing users to active so they aren't locked out
UPDATE "new_User" SET "accessStatus" = 'active', "accessGrantedAt" = CURRENT_TIMESTAMP, "accessSource" = 'admin_grant';
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "AccessCode_code_key" ON "AccessCode"("code");

-- CreateIndex
CREATE UNIQUE INDEX "AccessCodeRedemption_accessCodeId_userId_key" ON "AccessCodeRedemption"("accessCodeId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "CourseRating_courseShareId_userId_key" ON "CourseRating"("courseShareId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_stripeSessionId_key" ON "Payment"("stripeSessionId");
