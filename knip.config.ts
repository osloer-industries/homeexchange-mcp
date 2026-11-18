import type { KnipConfig } from "knip";

const config: KnipConfig = {
  workspaces: {
    ".": {
      entry: [
        "src/mcp.ts",
        "scripts/**/*.{mjs,mts}",
      ],
      project: ["src/**/*.ts", "scripts/**/*.{ts,mjs}"],
    },
    "packages/eslint-sonarjs": {
      entry: ["**/*.test.mjs"],
      project: ["**/*.{mjs,ts}"],
    },
  },
};

export default config;