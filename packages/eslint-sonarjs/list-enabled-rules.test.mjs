import { describe, expect, it } from "vitest";

import { listEnabledSonarjsRules } from "./list-enabled-rules.mjs";

describe("listEnabledSonarjsRules", () => {
  it("returns recommended sonarjs rules in localeCompare order", () => {
    const lines = listEnabledSonarjsRules();
    expect(lines.length).toBeGreaterThan(100);
    expect(lines.every((line) => line.startsWith("sonarjs/"))).toBe(true);
    const sorted = [...lines].toSorted((a, b) => a.localeCompare(b));
    expect(lines).toEqual(sorted);
  });
});
