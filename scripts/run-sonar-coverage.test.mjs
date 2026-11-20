import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./ci-npm-workspace.mjs", () => ({
  runCiNpmWorkspace: vi.fn(),
}));

vi.mock("./run-npm.mjs", () => ({
  runNpm: vi.fn(),
}));

const { runCiNpmWorkspace } = await import("./ci-npm-workspace.mjs");
const { runNpm } = await import("./run-npm.mjs");
const { runSonarCoverage } = await import("./run-sonar-coverage.mjs");

describe("runSonarCoverage", () => {
  afterEach(() => {
    vi.mocked(runCiNpmWorkspace).mockReset();
    vi.mocked(runNpm).mockReset();
  });

  it("installs nested eslint-sonarjs then runs test:coverage", () => {
    runSonarCoverage({ runInstall: runNpm });
    expect(runCiNpmWorkspace).toHaveBeenCalledWith({
      runInstall: runNpm,
      skipRootCi: true,
      installEslintSonarjs: true,
    });
    expect(runNpm).toHaveBeenCalledWith(["run", "test:coverage"], { stdio: "inherit" });
  });
});