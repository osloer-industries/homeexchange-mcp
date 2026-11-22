import { execFileSync } from "node:child_process";
import { statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/** Vendor instruction paths that must not be tracked when AGENTS.md is canonical (ADR 0002). */
export const FORBIDDEN_TRACKED_INSTRUCTION_FILES = ["CLAUDE.md", ".claude/CLAUDE.md"] as const;

const ADR_REFERENCE = "docs/adr/0002-agents-md-single-instruction-file.md";
function gitExecutable(): string {
  return process.env.NO_CLAUDE_GIT_PATH ?? "git";
}

export function findForbiddenTrackedInstructionFiles(
  trackedPaths: readonly string[],
): string[] {
  const trackedSet = new Set(
    trackedPaths.map((entry) => entry.replaceAll("\\", "/").trim()).filter(Boolean),
  );
  return FORBIDDEN_TRACKED_INSTRUCTION_FILES.filter((forbidden) => trackedSet.has(forbidden));
}

export function findForbiddenInstructionFilesOnDisk(rootDir: string): string[] {
  const found: string[] = [];
  for (const relativePath of FORBIDDEN_TRACKED_INSTRUCTION_FILES) {
    try {
      statSync(join(rootDir, relativePath));
      found.push(relativePath);
    } catch {
      // Path absent — expected in a clean tree.
    }
  }
  return found;
}

export function listGitTrackedPaths(rootDir: string): string[] {
  const output = execFileSync(gitExecutable(), ["ls-files"], {
    cwd: rootDir,
    encoding: "utf8",
  });
  return output
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function errorText(error: unknown): string {
  if (!(error instanceof Error)) return "";
  let text = error.message;
  const stderr = Reflect.get(error, "stderr");
  if (typeof stderr === "string") text += stderr;
  return text;
}

function isNotAGitRepositoryError(error: unknown): boolean {
  return errorText(error).includes("not a git repository");
}

export function resolveClaudeInstructionViolations(rootDir: string): string[] {
  try {
    return findForbiddenTrackedInstructionFiles(listGitTrackedPaths(rootDir));
  } catch (error) {
    if (!isNotAGitRepositoryError(error)) {
      throw error;
    }
    return findForbiddenInstructionFilesOnDisk(rootDir);
  }
}

export function assertNoTrackedClaudeInstructionFiles(rootDir: string): void {
  const violations = resolveClaudeInstructionViolations(rootDir);
  if (violations.length === 0) {
    return;
  }
  throw new Error(
    `Tracked Claude Code instruction file(s) are not allowed: ${violations.join(", ")}. ` +
      `Keep AGENTS.md as the only agent-instruction file (see ${ADR_REFERENCE}). ` +
      "Remove the file from the index with git rm --cached if Claude Code /init created it.",
  );
}

function repoRootFromModuleUrl(moduleUrl: string): string {
  return resolve(dirname(fileURLToPath(moduleUrl)), "..");
}

export function runNoClaudeMdCheckCli(moduleUrl: string): void {
  const rootDir = repoRootFromModuleUrl(moduleUrl);
  assertNoTrackedClaudeInstructionFiles(rootDir);
  process.stdout.write("No tracked CLAUDE.md instruction files (ADR 0002 OK).\n");
}

export function isDirectExecution(moduleUrl: string, argvEntry: string | undefined): boolean {
  if (argvEntry === undefined) return false;
  return moduleUrl === pathToFileURL(resolve(argvEntry)).href;
}

/** @returns process exit code (0 success, 1 failure). */
export function runNoClaudeMdCliEntry(moduleUrl: string): number {
  try {
    runNoClaudeMdCheckCli(moduleUrl);
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    return 1;
  }
}

if (isDirectExecution(import.meta.url, process.argv[1])) {
  process.exitCode = runNoClaudeMdCliEntry(import.meta.url);
}
