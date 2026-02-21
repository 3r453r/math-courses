import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
      // Intentional initialization pattern: setState called synchronously in
      // useEffect to sync with external systems (matchMedia, localStorage, etc.)
      "react-hooks/set-state-in-effect": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    ".next-test/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Ephemeral one-off scripts (gitignored, not reusable utilities):
    "scripts/gen-*.mjs",
    "scripts/assemble-batch*.mjs",
    "scripts/assemble-enhancements.mjs",
    "scripts/enhance-lesson-examples.mts",
    "scripts/ab-test-*.mts",
    // Debug dumps:
    ".debug-dumps/**",
  ]),
]);

export default eslintConfig;
