import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("node:child_process", () => ({
  spawnSync: vi.fn(),
}));

const { spawnSync } = await import("node:child_process");
const { resolveConfigPath, resolveEslintBin, resolveLintTargets, runEslintSonarjs } = await import("./run.mjs");

describe("resolveLintTargets", () => {
  it("returns defaults when no args are passed", () => {
    expect(resolveLintTargets([])).toEqual(["src", "scripts", "packages/eslint-sonarjs"]);
  });

  it("forwards explicit paths", () => {
    expect(resolveLintTargets(["scripts/run-npm.mjs"])).toEqual(["scripts/run-npm.mjs"]);
  });
});

describe("runEslintSonarjs", () => {
  afterEach(() => {
    vi.mocked(spawnSync).mockReset();
  });

  it("invokes eslint with repo config and targets", () => {
    vi.mocked(spawnSync).mockReturnValue({
      status: 0,
      pid: 1,
      output: [],
      stdout: "",
      stderr: "",
      signal: null,
    });
    runEslintSonarjs(["src/index.ts"], {
      eslintBin: "/eslint/bin/eslint.js",
      configPath: "/pkg/eslint.config.mjs",
      cwd: "/repo",
      execPath: "/node",
    });
    expect(spawnSync).toHaveBeenCalledWith(
      "/node",
      ["/eslint/bin/eslint.js", "-c", "/pkg/eslint.config.mjs", "src/index.ts"],
      { cwd: "/repo", stdio: "inherit" },
    );
  });
});

describe("path helpers", () => {
  it("resolves eslint bin and config within the package", () => {
    expect(resolveEslintBin()).toMatch(/eslint[/\\]bin[/\\]eslint\.js$/);
    expect(resolveConfigPath()).toMatch(/eslint\.config\.mjs$/);
  });
});

describe("runEslintSonarjs defaults", () => {
  afterEach(() => {
    vi.mocked(spawnSync).mockReset();
  });

  it("uses default eslint paths and repo cwd", () => {
    vi.mocked(spawnSync).mockReturnValue({
      status: 0,
      pid: 1,
      output: [],
      stdout: "",
      stderr: "",
      signal: null,
    });
    runEslintSonarjs([]);
    expect(spawnSync).toHaveBeenCalledOnce();
    const args = vi.mocked(spawnSync).mock.calls[0]?.[1];
    expect(args).toContain("-c");
    expect(args).toContain("src");
  });
});
