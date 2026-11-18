# Consuming org reusable workflows

Shared GitHub Actions behavior lives in [osloer-industries/.github](https://github.com/osloer-industries/.github).
This repository keeps **thin caller workflows** under `.github/workflows/` and pins each org `uses:` ref to a full
commit SHA with a `# v0.x.y` version comment (never `# main`). The org contract, input defaults, and copy-paste YAML
live in
[consuming-workflows.md](https://github.com/osloer-industries/.github/blob/348b254ef112f4f8e239a41e7adb3f3e2dac3944/docs/consuming-workflows.md)
on that repository (**v0.1.6**: `348b254ef112f4f8e239a41e7adb3f3e2dac3944`).

## Callers in this repository

| Caller file | Org reusable | Notes |
| --- | --- | --- |
| [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) | `workflow-security.yml` | actionlint + zizmor; **job**-level `actions: read` (no workflow-level `actions: read` per Sonar `githubactions:S8264`). |
| same | `node-npm-quality.yml` | Check name **Quality** (`npm run check`, production audit). |
| same | `codeql-javascript-typescript.yml` | Public repo: default Code Scanning upload. Weekly schedule inherits from `CI` workflow. |
| same | `sonarqube-cloud-node.yml` | Check name **Analyze**; `coverage-npm-script: test` (Vitest coverage). Caller job needs `pull-requests: read`. Skips when `SONAR_TOKEN` is empty (fork/Dependabot). |
| same | `sonarcloud-zero-issues.yml` | PR-only; polls SonarCloud for zero open issues at head SHA; `ce-task-id` from `sonar-analyze` (v0.1.6+). |
| same | `ci-passed.yml` | Aggregate required check; tolerates skipped `sonar-zero-open-issues` on non-PR events only. |
| [`.github/workflows/dependency-review.yml`](../.github/workflows/dependency-review.yml) | `dependency-review.yml` | Pin v0.1.7+; gate check **Review dependency changes** (OSV job named for private repos only); caller job `security-events: write`. |
| [`.github/workflows/pr-title.yml`](../.github/workflows/pr-title.yml) | `semantic-pull-request.yml` | Conventional Commits PR titles (`pull_request`; zizmor blocks `pull_request_target`). |
| [`.github/workflows/release.yml`](../.github/workflows/release.yml) | `release-please.yml` | `secrets.RELEASE_TOKEN` (not the org release GitHub App). |

Former inlined jobs removed from this repo: standalone `codeql.yml`, inlined quality/Sonar in `ci.yml`, marketplace dependency-review and semantic-title steps, and inlined Release Please.

Dependabot `github-actions` updates on `/` bump Action SHAs and org reusable workflow SHAs (`ci(deps)`). Org reusables
are grouped separately as `osloer-reusables` (`osloer-industries/.github*`).

Branch protection should require only **`ci-passed`** on the `CI` workflow (not individual scanner job names). Until rulesets are updated, familiar checks still appear separately (`Quality`, `Analyze`, `CodeQL`, and so on).

## SonarCloud

This project uses the **CI scanner** (`sonarqube-cloud-node.yml`), not SonarCloud Automatic Analysis alone. PRs also run `sonarcloud-zero-issues.yml` inside `ci-passed`.

Configure [`sonar-project.properties`](../sonar-project.properties) and repository or organization secret `SONAR_TOKEN`.

## Private repository CodeQL

This repository is **public** and uses default Code Scanning upload. Private org repos without GitHub Advanced Security
should set `code-scanning-upload: false` and keep `fail-on-sarif-level: error` per the org doc — never enable paid GHAS
for CodeQL alone.