#!/usr/bin/env node
// Tooling rationale: ADR 0009 (docs/adr/0009-tooling-and-quality-gate-stack.md)
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { runNpm } from "./run-npm.mjs";

const pkgDir = path.resolve(fileURLToPath(new URL("../packages/eslint-sonarjs", import.meta.url)));

export function eslintSonarjsInstallMarker() {
  return path.join(pkgDir, "node_modules", "eslint", "package.json");
}

export function ensureEslintSonarjsDependencies(runInstall = runNpm) {
  const marker = eslintSonarjsInstallMarker();
  if (!existsSync(marker)) {
    runInstall(["ci", "--ignore-scripts"], { cwd: pkgDir, stdio: "inherit" });
  }
  return marker;
}

/**
 * @param {readonly string[]} userArgs
 * @param {{ runInstall?: typeof runNpm, spawn?: typeof spawnSync, execPath?: string }} [options]
 */
export function runLintSonarjs(userArgs, options = {}) {
  const runInstall = options.runInstall ?? runNpm;
  const spawn = options.spawn ?? spawnSync;
  const execPath = options.execPath ?? process.execPath;
  ensureEslintSonarjsDependencies(runInstall);
  return spawn(execPath, ["run.mjs", ...userArgs], { cwd: pkgDir, stdio: "inherit" });
}

const isMain = process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  const result = runLintSonarjs(process.argv.slice(2));
  process.exit(result.status ?? 1);
}
