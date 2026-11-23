import { describe, expect, it } from "vitest";

import { listEnabledSonarjsRules } from "./list-enabled-rules.mjs";

describe("listEnabledSonarjsRules", () => {
  it("returns recommended sonarjs rules in localeCompare order", () => {
    const lines = listEnabledSonarjsRules();
    expect(lines.length).toBeGreaterThan(100);
    expect(lines.some((line) => line.startsWith("sonarjs/"))).toBe(true);
    expect(lines).toContain("no-await-in-loop");
    expect(lines).toContain("@typescript-eslint/require-await");
    const sorted = [...lines].toSorted((a, b) => a.localeCompare(b));
    expect(lines).toEqual(sorted);
  });
});
