# Playwright in CI and local development

Continuous integration installs dependencies with `npm ci --ignore-scripts`, so
Playwright browser downloads do not run in the org **Quality** job. Unit tests
mock browser adapters; only local `record` / `login` flows need a browser install.

After `npm ci` locally, run `npx playwright install chromium` when exercising
session capture or browser login.
