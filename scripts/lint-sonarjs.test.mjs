import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    existsSync: vi.fn(),
  };
});

vi.mock("node:child_process", () => ({
  spawnSync: vi.fn(),
}));

vi.mock("./run-npm.mjs", () => ({
  runNpm: vi.fn(),
}));

const { existsSync } = await import("node:fs");
const { spawnSync } = await import("node:child_process");
const { runNpm } = await import("./run-npm.mjs");
const { ensureEslintSonarjsDependencies, eslintSonarjsInstallMarker, runLintSonarjs } = await import(
  "./lint-sonarjs.mjs",
);

describe("eslintSonarjsInstallMarker", () => {
  it("points at nested eslint package.json", () => {
    expect(eslintSonarjsInstallMarker()).toMatch(/packages[/\\]eslint-sonarjs[/\\]node_modules[/\\]eslint[/\\]package\.json$/);
  });
});

describe("ensureEslintSonarjsDependencies", () => {
  afterEach(() => {
    vi.mocked(existsSync).mockReset();
    vi.mocked(runNpm).mockReset();
  });

  it("runs npm ci when eslint is not installed", () => {
    vi.mocked(existsSync).mockReturnValue(false);
    const marker = ensureEslintSonarjsDependencies(runNpm);
    expect(runNpm).toHaveBeenCalledWith(["ci", "--ignore-scripts"], expect.objectContaining({ stdio: "inherit" }));
    expect(marker).toMatch(/eslint[/\\]package\.json$/);
  });

  it("skips install when marker exists", () => {
    vi.mocked(existsSync).mockReturnValue(true);
    ensureEslintSonarjsDependencies(runNpm);
    expect(runNpm).not.toHaveBeenCalled();
  });
});

describe("runLintSonarjs", () => {
  afterEach(() => {
    vi.mocked(existsSync).mockReset();
    vi.mocked(spawnSync).mockReset();
  });

  it("delegates to nested run.mjs after ensuring deps", () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(spawnSync).mockReturnValue({
      status: 0,
      pid: 1,
      output: [],
      stdout: "",
      stderr: "",
      signal: null,
    });
    const result = runLintSonarjs(["scripts/setup.mjs"], { execPath: "/node" });
    expect(spawnSync).toHaveBeenCalledWith(
      "/node",
      ["run.mjs", "scripts/setup.mjs"],
      expect.objectContaining({ stdio: "inherit" }),
    );
    expect(result.status).toBe(0);
  });
});
