import { fileURLToPath, URL } from "node:url";
import { createRequire } from "node:module";
import { cloudflareTest } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

const resolve = (path: string) => fileURLToPath(new URL(path, import.meta.url));
// The test plugin currently bundles an older workerd than the pinned Wrangler.
// Use the same installed runtime as local app development for this compat date.
const require = createRequire(import.meta.url);
process.env.MINIFLARE_WORKERD_PATH ??= (
  createRequire(require.resolve("wrangler/package.json"))("workerd") as {
    default: string;
  }
).default;

export default defineConfig({
  resolve: {
    alias: [
      { find: "@/server/model", replacement: resolve("../fixtures/model.ts") },
      { find: "@/server", replacement: resolve("../../apps/server/src") },
      {
        find: "@stead/contracts",
        replacement: resolve("../../packages/contracts/src/index.ts"),
      },
    ],
  },
  plugins: [
    cloudflareTest({ wrangler: { configPath: resolve("./wrangler.jsonc") } }),
  ],
  test: {
    name: "runtime",
    root: resolve("../../"),
    include: ["tests/runtime/**/*.test.ts"],
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
