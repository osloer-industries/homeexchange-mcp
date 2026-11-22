# eslint-sonarjs (local package)

Runs [`eslint-plugin-sonarjs`](https://github.com/SonarSource/eslint-plugin-sonarjs) **`recommended`** rules against
`src/`, `scripts/`, and template packages.

This package pins **TypeScript 6** for `@typescript-eslint/parser` because TypeScript 7 is not yet supported by
typescript-eslint. The repository root keeps **TypeScript 7** for `tsc`.

## Commands

From the repository root:

```sh
npm run lint:sonarjs
npm run list-rules --prefix packages/eslint-sonarjs
```

The root `lint:sonarjs` script installs this package’s dependencies with `npm ci --ignore-scripts` when needed, then
runs `run.mjs`.
