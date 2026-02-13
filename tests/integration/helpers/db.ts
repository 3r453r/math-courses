import { PrismaClient } from "@/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { execSync } from "child_process";
import path from "path";
import fs from "fs";

const TEST_DB_PATH = path.resolve(process.cwd(), "test.db");
const TEST_DB_URL = `file:${TEST_DB_PATH}`;

let testPrisma: PrismaClient | null = null;

export function getTestPrisma(): PrismaClient {
  if (!testPrisma) {
    throw new Error(
      "Test Prisma client not initialized. Call setupTestDatabase() first."
    );
  }
  return testPrisma;
}

export async function setupTestDatabase(): Promise<void> {
  // Remove stale test DB if it exists
  for (const suffix of ["", "-shm", "-wal", "-journal"]) {
    const p = TEST_DB_PATH + suffix;
    if (fs.existsSync(p)) {
      fs.unlinkSync(p);
    }
  }

  // Use prisma db push to create schema in test DB
  execSync("npx prisma db push --accept-data-loss", {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: TEST_DB_URL },
    stdio: "pipe",
  });

  // Create PrismaClient AFTER db push to avoid stale connections
  const adapter = new PrismaLibSql({ url: TEST_DB_URL });
  testPrisma = new PrismaClient({ adapter });
}

export async function cleanDatabase(): Promise<void> {
  const prisma = getTestPrisma();
  // Delete in dependency order (children first)
  await prisma.chatMessage.deleteMany();
  await prisma.note.deleteMany();
  await prisma.quizAttempt.deleteMany();
  await prisma.quiz.deleteMany();
  await prisma.diagnosticAttempt.deleteMany();
  await prisma.diagnosticQuiz.deleteMany();
  await prisma.courseEdge.deleteMany();
  await prisma.lesson.deleteMany();
  await prisma.course.deleteMany();
}

export async function disconnectTestDatabase(): Promise<void> {
  if (testPrisma) {
    await testPrisma.$disconnect();
    testPrisma = null;
  }
}
