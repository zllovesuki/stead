import js from "@eslint/js";
import babelParser from "@babel/eslint-parser";
import reactHooks from "eslint-plugin-react-hooks";
import { reactRefresh } from "eslint-plugin-react-refresh";
import globals from "globals";

export default [
  {
    ignores: [
      ".local/**",
      "**/node_modules/**",
      "**/dist/**",
      "**/.wrangler/**",
      "**/worker-configuration.d.ts",
      "playwright-report/**",
      "test-results/**",
    ],
  },
  {
    files: ["**/*.{ts,tsx,mjs}"],
    languageOptions: {
      parser: babelParser,
      parserOptions: {
        requireConfigFile: false,
        babelOptions: {
          babelrc: false,
          configFile: false,
          parserOpts: { plugins: ["typescript", "jsx"] },
        },
      },
      globals: globals.node,
    },
    // TypeScript 7 owns type/name/usage checks; Babel parses syntax without the retired TS API.
    rules: {
      ...js.configs.recommended.rules,
      "no-undef": "off",
      "no-unused-vars": "off",
    },
  },
  { ...reactRefresh.configs.vite(), files: ["apps/client/src/**/*.{ts,tsx}"] },
  {
    files: ["apps/client/src/**/*.{ts,tsx}", "packages/ui/src/**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooks },
    languageOptions: { globals: globals.browser },
    rules: {
      ...reactHooks.configs.flat["recommended-latest"].rules,
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@/server/**",
                "**/apps/server/**",
                "node:*",
                "cloudflare:*",
              ],
              message:
                "Browser code consumes public @stead/contracts, never Worker implementation or platform capabilities.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["packages/contracts/src/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@/server/**",
                "@/client/**",
                "**/apps/**",
                "react",
                "cloudflare:*",
                "node:*",
              ],
              message:
                "Contracts remain independent of application and runtime implementations.",
            },
          ],
        },
      ],
    },
  },
];
