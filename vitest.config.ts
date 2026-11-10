import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts"],
      reporter: ["text", "html", "lcov"],
    },
    projects: [
      { test: { name: "unit", include: [], includeSource: ["src/**/*.ts"] } },
      { test: { name: "integration", include: ["src/**/*.test.ts"] } },
      { test: { name: "e2e", include: ["tests/**/*.test.ts"] } },
    ],
  },
});
