# Consuming org reusable workflows

Shared GitHub Actions behavior lives in [osloer-industries/.github](https://github.com/osloer-industries/.github).
This repository keeps **thin caller workflows** under `.github/workflows/` and pins each `uses:` ref to a full
commit SHA. The org contract, input defaults, and copy-paste YAML live in
[consuming-workflows.md](https://github.com/osloer-industries/.github/blob/d4865a4b2c70c8433188f5200beac104b1c7fe86/docs/consuming-workflows.md)
on that repository.

## Callers in this repository

| Caller file | Org reusable | Notes |
| --- | --- | --- |
| [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) (`workflow-security` job) | `workflow-security.yml` | actionlint + zizmor; **job**-level `actions: read` (workflow-level `actions: read` is omitted per Sonar `githubactions:S8264`); default empty `min-severity` / `min-confidence`. |
| [`.github/workflows/codeql.yml`](../.github/workflows/codeql.yml) | `codeql-javascript-typescript.yml` | Public repository: default Code Scanning upload (`code-scanning-upload: true`). |

Repo-specific jobs that stay inlined: CI quality (typecheck, lint, audit, SonarCloud), dependency review, pull request title (`pull_request`, not `pull_request_target`), and Release Please.

Dependabot `github-actions` updates on `/` bump Action SHAs and org reusable workflow SHAs together (`ci(deps)`).

When adding org reusables as required branch protection checks, use the names from the
[org workflow table](https://github.com/osloer-industries/.github/blob/d4865a4b2c70c8433188f5200beac104b1c7fe86/docs/consuming-workflows.md#available-reusables).
For `workflow-security` on `CI`, the check is typically `CI / workflow-security / Workflow security`.
For CodeQL, the reusable job name is `Analyze JavaScript and TypeScript` (check `CodeQL / analyze / Analyze JavaScript and TypeScript`).

## Private repository CodeQL

This repository is **public** and uses default Code Scanning upload. Private org repos without GitHub Advanced Security
should set `code-scanning-upload: false` and keep `fail-on-sarif-level: error` per the org doc — never enable paid GHAS
for CodeQL alone.
