import { readFile } from "node:fs/promises";

const packageJsonUrl = new URL("../package.json", import.meta.url);
const packageJson = JSON.parse(await readFile(packageJsonUrl, "utf8"));
const exactVersion = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;
const violations = [];

function checkVersions(value, path) {
  if (typeof value === "string") {
    if (!exactVersion.test(value)) {
      violations.push(`${path}: ${value}`);
    }
    return;
  }

  if (value && typeof value === "object" && !Array.isArray(value)) {
    for (const [name, version] of Object.entries(value)) {
      checkVersions(version, `${path}.${name}`);
    }
  }
}

for (const section of [
  "dependencies",
  "devDependencies",
  "optionalDependencies",
  "peerDependencies",
  "overrides",
]) {
  if (packageJson[section]) {
    checkVersions(packageJson[section], section);
  }
}

if (violations.length > 0) {
  console.error("Dependency versions must use exact semantic versions:");
  for (const violation of violations) {
    console.error(`  ${violation}`);
  }
  process.exit(1);
}

console.log("All dependency versions are exact.");
