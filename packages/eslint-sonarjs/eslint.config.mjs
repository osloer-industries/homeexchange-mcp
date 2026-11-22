// Tooling rationale: ADR 0009 (../../docs/adr/0009-tooling-and-quality-gate-stack.md)
import path from "node:path";
import { fileURLToPath } from "node:url";

import tsParser from "@typescript-eslint/parser";
import tseslint from "@typescript-eslint/eslint-plugin";
import sonarjs from "eslint-plugin-sonarjs";

import {
  buildSonarjsJavaScriptFlatRules,
  buildSonarjsTypeScriptFlatRules,
} from "./sonarjs-rules.mjs";

const repoRoot = path.resolve(fileURLToPath(new URL("../..", import.meta.url)));
const recommended = sonarjs.configs.recommended;
const sonarTsRules = buildSonarjsTypeScriptFlatRules();
const sonarJsRules = buildSonarjsJavaScriptFlatRules();

const tsFiles = ["src/**/*.ts", "scripts/**/*.mts", "scripts/**/*.test.ts"];
const jsFiles = ["scripts/**/*.mjs", "packages/**/*.mjs"];

const sonarPlugins = {
  ...recommended.plugins,
  "@typescript-eslint": tseslint,
};

export default [
  {
    ignores: ["dist/**", "coverage/**", "node_modules/**"],
  },
  {
    name: "sonarjs/shift-left-ts",
    files: tsFiles,
    plugins: sonarPlugins,
    rules: sonarTsRules,
    settings: recommended.settings ?? {},
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: ["./tsconfig.json", "./tsconfig.scripts.json"],
        tsconfigRootDir: repoRoot,
      },
    },
  },
  {
    name: "sonarjs/shift-left-js",
    files: jsFiles,
    plugins: sonarPlugins,
    rules: sonarJsRules,
    settings: recommended.settings ?? {},
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
    },
  },
];