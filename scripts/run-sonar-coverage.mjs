#!/usr/bin/env node
// Tooling rationale: ADR 0009 (docs/adr/0009-tooling-and-quality-gate-stack.md)
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { runCiNpmWorkspace } from "./ci-npm-workspace.mjs";
import { runNpm } from "./run-npm.mjs";

/**
 * Coverage for org `sonarqube-cloud-node.yml` after root `npm ci` (nested eslint-sonarjs only).
 *
 * @param {{ runInstall?: typeof runNpm }} [options]
 */
export function runSonarCoverage(options = {}) {
  const runInstall = options.runInstall ?? runNpm;
  runCiNpmWorkspace({
    runInstall,
    skipRootCi: true,
    installEslintSonarjs: true,
  });
  runInstall(["run", "test:coverage"], { stdio: "inherit" });
}

function isDirectExecution(moduleUrl, argvEntry) {
  if (argvEntry === undefined) return false;
  return moduleUrl === pathToFileURL(resolve(argvEntry)).href;
}

if (isDirectExecution(import.meta.url, process.argv[1])) {
  runSonarCoverage();
}