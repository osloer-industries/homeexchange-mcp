import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";

export function npmExecutablePath() {
  const npmExecPath = process.env.npm_execpath;
  if (typeof npmExecPath === "string" && npmExecPath.length > 0 && existsSync(npmExecPath)) {
    return npmExecPath;
  }
  const adjacent = join(dirname(process.execPath), process.platform === "win32" ? "npm.cmd" : "npm");
  if (existsSync(adjacent)) return adjacent;
  throw new Error("Unable to locate npm without using PATH. Run via npm or install npm next to node.");
}

/**
 * @param {readonly string[]} args
 * @param {import("node:child_process").ExecFileSyncOptions} [options]
 */
export function runNpm(args, options = {}) {
  execFileSync(npmExecutablePath(), args, options);
}
