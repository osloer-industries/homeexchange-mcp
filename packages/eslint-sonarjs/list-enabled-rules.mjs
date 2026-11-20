import sonarjs from "eslint-plugin-sonarjs";

export function listEnabledSonarjsRules() {
  const recommendedRules = sonarjs.configs.recommended.rules ?? {};
  return Object.entries(recommendedRules)
    .filter(([, severity]) => severity === "error" || severity === 2)
    .map(([name]) => name)
    .toSorted((a, b) => a.localeCompare(b));
}

const isMain = process.argv[1] !== undefined && import.meta.url.endsWith(process.argv[1].replaceAll("\\", "/"));

if (isMain) {
  for (const rule of listEnabledSonarjsRules()) {
    process.stdout.write(`${rule}\n`);
  }
}
