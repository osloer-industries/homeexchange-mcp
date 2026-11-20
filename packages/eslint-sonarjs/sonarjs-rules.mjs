// Tooling rationale: ADR 0009 (../../docs/adr/0009-tooling-and-quality-gate-stack.md)
import sonarjs from "eslint-plugin-sonarjs";

/** @typedef {import("eslint").Linter.RuleEntry} RuleEntry */

/**
 * Sonar rules beyond `recommended` that SonarCloud commonly enforces locally (see docs/sonar-quality-gate.md).
 *
 * @type {Readonly<Record<string, RuleEntry>>}
 */
const sonarCloudShiftLeftRules = {
  "no-await-in-loop": "error",
  "sonarjs/no-duplicate-string": "error",
  "sonarjs/nested-control-flow": "error",
};

/** Type-aware rules (TypeScript sources only). @type {Readonly<Record<string, RuleEntry>>} */
const sonarCloudShiftLeftTypeScriptRules = {
  "@typescript-eslint/require-await": "error",
};

/** @param {unknown} severity */
function recommendedSeverityToError(severity) {
  if (severity === undefined || severity === "off" || severity === 0) {
    return undefined;
  }
  if (Array.isArray(severity)) {
    const [level, ...options] = severity;
    if (level === "off" || level === 0) {
      return undefined;
    }
    /** @type {RuleEntry} */
    const ruleWithOptions = ["error", ...options];
    return ruleWithOptions;
  }
  if (severity === "error" || severity === "warn" || severity === 1 || severity === 2) {
    /** @type {RuleEntry} */
    const rule = ["error"];
    return rule;
  }
  return undefined;
}

/**
 * @param {Readonly<Record<string, RuleEntry>>} extra
 */
function buildRulesFromRecommended(extra) {
  const recommendedRules = sonarjs.configs.recommended.rules ?? {};
  /** @type {Record<string, RuleEntry>} */
  const rules = {};

  for (const [name, severity] of Object.entries(recommendedRules)) {
    const asError = recommendedSeverityToError(severity);
    if (asError !== undefined) {
      rules[name] = asError;
    }
  }

  for (const [name, severity] of Object.entries(extra)) {
    rules[name] = severity;
  }

  return rules;
}

export function buildSonarjsTypeScriptFlatRules() {
  return buildRulesFromRecommended({
    ...sonarCloudShiftLeftRules,
    ...sonarCloudShiftLeftTypeScriptRules,
  });
}

export function buildSonarjsJavaScriptFlatRules() {
  return buildRulesFromRecommended(sonarCloudShiftLeftRules);
}