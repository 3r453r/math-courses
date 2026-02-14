/*
  Warnings:

  - You are about to drop the column `apiKeyIv` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `encryptedApiKey` on the `User` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT,
    "email" TEXT,
    "emailVerified" DATETIME,
    "image" TEXT,
    "encryptedApiKeys" TEXT,
    "role" TEXT NOT NULL DEFAULT 'user',
    "accessStatus" TEXT NOT NULL DEFAULT 'pending',
    "accessGrantedAt" DATETIME,
    "accessSource" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_User" ("accessGrantedAt", "accessSource", "accessStatus", "createdAt", "email", "emailVerified", "id", "image", "name", "role", "updatedAt") SELECT "accessGrantedAt", "accessSource", "accessStatus", "createdAt", "email", "emailVerified", "id", "image", "name", "role", "updatedAt" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
