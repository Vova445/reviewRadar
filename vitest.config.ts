import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["server/d1-auth.ts", "server/security/workspace-authz.ts", "server/dashboard-metrics.ts"],
      reporter: ["text", "lcov"],
      thresholds: { perFile: true, lines: 70, functions: 70, branches: 70, statements: 70 },
    },
  },
});
