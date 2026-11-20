import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("node:child_process", () => ({
  execFileSync: vi.fn(),
}));

vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    existsSync: vi.fn(),
  };
});

const { execFileSync } = await import("node:child_process");
const { existsSync } = await import("node:fs");
const { npmExecutablePath, runNpm } = await import("./run-npm.mjs");

const STUB_NPM_CLI_PATH = "/usr/local/lib/node_modules/npm/bin/npm-cli.js";

describe("npmExecutablePath", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.mocked(existsSync).mockReset();
  });

  it("prefers npm_execpath when it exists", () => {
    vi.stubEnv("npm_execpath", STUB_NPM_CLI_PATH);
    vi.mocked(existsSync).mockImplementation((path) => path === STUB_NPM_CLI_PATH);
    expect(npmExecutablePath()).toBe(STUB_NPM_CLI_PATH);
  });

  it("falls back to npm next to node", () => {
    vi.stubEnv("npm_execpath", "");
    vi.mocked(existsSync).mockImplementation((path) => String(path).endsWith("/npm"));
    expect(npmExecutablePath()).toMatch(/npm$/);
  });

  it("throws when npm cannot be resolved", () => {
    vi.stubEnv("npm_execpath", "");
    vi.mocked(existsSync).mockReturnValue(false);
    expect(() => npmExecutablePath()).toThrow("Unable to locate npm");
  });
});

describe("runNpm", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.mocked(existsSync).mockReset();
    vi.mocked(execFileSync).mockReset();
  });

  it("runs npm with resolved executable", () => {
    const npmPath = join(mkdtempSync(join(tmpdir(), "run-npm-exec-")), "npm-cli.js");
    vi.stubEnv("npm_execpath", npmPath);
    vi.mocked(existsSync).mockReturnValue(true);
    runNpm(["run", "check"], { stdio: "inherit" });
    expect(execFileSync).toHaveBeenCalledWith(npmPath, ["run", "check"], { stdio: "inherit" });
  });
});
