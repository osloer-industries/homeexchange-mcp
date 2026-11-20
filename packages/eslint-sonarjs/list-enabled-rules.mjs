import { buildSonarjsTypeScriptFlatRules } from "./sonarjs-rules.mjs";

export function listEnabledSonarjsRules() {
  return Object.keys(buildSonarjsTypeScriptFlatRules()).toSorted((a, b) => a.localeCompare(b));
}

const isMain = process.argv[1] !== undefined && import.meta.url.endsWith(process.argv[1].replaceAll("\\", "/"));

if (isMain) {
  for (const rule of listEnabledSonarjsRules()) {
    process.stdout.write(`${rule}\n`);
  }
}
