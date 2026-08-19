import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["apps/*/test/**/*.integration.test.ts", "packages/*/test/**/*.integration.test.ts"],
    fileParallelism: false,
  },
});
