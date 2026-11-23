import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./run-npm.mjs", () => ({
  runNpm: vi.fn(),
}));

const { runNpm } = await import("./run-npm.mjs");
const { runCiNpmWorkspace } = await import("./ci-npm-workspace.mjs");

const CI_IGNORE_SCRIPTS = ["ci", "--ignore-scripts"];

describe("runCiNpmWorkspace", () => {
  afterEach(() => {
    vi.mocked(runNpm).mockReset();
  });

  it("runs root npm ci by default", () => {
    runCiNpmWorkspace({ runInstall: runNpm });
    expect(runNpm).toHaveBeenCalledTimes(1);
    expect(runNpm).toHaveBeenCalledWith(CI_IGNORE_SCRIPTS, { stdio: "inherit" });
  });

  it("installs nested eslint-sonarjs when requested", () => {
    runCiNpmWorkspace({ runInstall: runNpm, installEslintSonarjs: true });
    expect(runNpm).toHaveBeenCalledTimes(2);
    expect(runNpm).toHaveBeenNthCalledWith(2, [...CI_IGNORE_SCRIPTS, "--prefix", "packages/eslint-sonarjs"], {
      stdio: "inherit",
    });
  });

  it("skips root npm ci when skipRootCi is set", () => {
    runCiNpmWorkspace({ runInstall: runNpm, skipRootCi: true, installEslintSonarjs: true });
    expect(runNpm).toHaveBeenCalledTimes(1);
    expect(runNpm).toHaveBeenCalledWith([...CI_IGNORE_SCRIPTS, "--prefix", "packages/eslint-sonarjs"], {
      stdio: "inherit",
    });
  });
});