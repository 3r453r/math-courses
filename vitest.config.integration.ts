import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    include: ["tests/integration/**/*.test.ts"],
    testTimeout: 30000,
    fileParallelism: false,
    setupFiles: ["tests/integration/helpers/setup.ts"],
  },
});
