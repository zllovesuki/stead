import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      {
        resolve: {
          alias: {
            "@/server": fileURLToPath(
              new URL("./apps/server/src", import.meta.url),
            ),
            "@stead/contracts": fileURLToPath(
              new URL("./packages/contracts/src/index.ts", import.meta.url),
            ),
          },
        },
        test: {
          name: "unit",
          environment: "node",
          include: ["apps/**/*.test.ts", "packages/**/*.test.ts"],
        },
      },
      "./tests/runtime/vitest.config.ts",
    ],
  },
});
