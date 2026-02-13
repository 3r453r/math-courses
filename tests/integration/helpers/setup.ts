import { vi, beforeAll, afterEach, afterAll } from "vitest";
import {
  setupTestDatabase,
  cleanDatabase,
  disconnectTestDatabase,
  getTestPrisma,
} from "./db";

// Mock the Prisma singleton — use a getter so it lazily retrieves
// the client after setupTestDatabase() has initialized it
vi.mock("@/lib/db", () => ({
  get prisma() {
    return getTestPrisma();
  },
}));

beforeAll(async () => {
  await setupTestDatabase();
}, 30000);

afterEach(async () => {
  await cleanDatabase();
});

afterAll(async () => {
  await disconnectTestDatabase();
});
