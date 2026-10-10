import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig(({ command }) => {
  const fixture = process.env.STEAD_TEST_MODE === "1";
  if (fixture && command !== "serve")
    throw new Error(
      "Test model substitution is only available in the development server.",
    );
  return {
    root: fileURLToPath(new URL(".", import.meta.url)),
    resolve: {
      alias: [
        ...(fixture
          ? [
              {
                find: "@/server/model",
                replacement: fileURLToPath(
                  new URL("../../tests/fixtures/model.ts", import.meta.url),
                ),
              },
            ]
          : []),
        {
          find: "@/server",
          replacement: fileURLToPath(new URL("../server/src", import.meta.url)),
        },
        {
          find: "@",
          replacement: fileURLToPath(new URL("./src", import.meta.url)),
        },
      ],
    },
    plugins: [
      react(),
      babel({ presets: [reactCompilerPreset()] }),
      tailwindcss(),
      cloudflare({
        configPath: fileURLToPath(
          new URL(
            fixture
              ? "../../tests/browser/wrangler.jsonc"
              : "../server/wrangler.jsonc",
            import.meta.url,
          ),
        ),
        persistState: {
          path: fileURLToPath(
            new URL(
              fixture
                ? "../../.local/browser-state"
                : "../server/.wrangler/state",
              import.meta.url,
            ),
          ),
        },
        ...(fixture ? { remoteBindings: false } : {}),
      }),
    ],
    server: { watch: { ignored: ["**/.local/**"] } },
    build: { target: "es2023", license: true },
  };
});
