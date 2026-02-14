import { PrismaClient } from "@/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import path from "path";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const tursoUrl = process.env.TURSO_DATABASE_URL;
  const tursoToken = process.env.TURSO_AUTH_TOKEN;

  let adapter;
  if (tursoUrl && tursoToken) {
    // Production: connect to Turso (libsql cloud)
    adapter = new PrismaLibSql({ url: tursoUrl, authToken: tursoToken });
  } else {
    // Local dev/test: use SQLite file
    const dbPath = process.env.DATABASE_URL
      ? process.env.DATABASE_URL.replace(/^file:/, "")
      : path.resolve(process.cwd(), "dev.db");
    adapter = new PrismaLibSql({ url: `file:${dbPath}` });
  }

  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
