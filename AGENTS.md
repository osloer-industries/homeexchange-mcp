# Agent Policy

## HomeExchange MCP safety

This repository can access private HomeExchange account data. Treat all session
files, cookies, bearer tokens, member data, messages, and exchange details as
sensitive. Never print, commit, upload, or copy them into issues or pull
requests.

### Approval-required tools

An agent must obtain explicit, per-call user approval immediately before it
invokes any tool that changes remote HomeExchange state:

- `send_message`
- `start_conversation`
- `pre_approve_exchange`
- `archive_conversation`
- `add_favorite`
- `remove_favorite`

Do not treat an earlier general request, a test plan, or tool availability as
approval. Before calling one of these tools, state the exact action and target,
and wait for the user to confirm it.

### Read-only validation

Read-only tools may be used for validation, but return only the minimum
necessary summary. Redact names, addresses, message contents, booking dates,
and identifiers unless the user specifically needs them.

### Toolchain

Use the Node.js 24 version in `.nvmrc` / `.node-version` (`engines.node` is
`>=24 <25`). Install with `npm ci` and run `npm run check` before opening a
pull request.

### Local MCP validation

Use `npm run test:mcp` to verify the built server through its real local stdio
MCP connection. This is credential-free and must not make network requests.
Use `npm run test:mcp -- --live` only when a current local `session.json` is
available and a read-only account check is intended. It must never print API
responses or session data. See the local-testing section in `README.md`.

## Agent workflow (org-wide, keep identical across osloer-industries repos)

These rules apply to every agent (Cursor, Grok Bot, any other) working in this repo.

### Quality
- Never cut corners on quality or architecture. Fix root causes. No `continue-on-error`, `|| true`, skipped or deleted tests, lowered thresholds, ignore or suppress comments, `NOSONAR`, exclusions, new lint/Sonar rule exceptions or overrides, audit ignores, `--legacy-peer-deps`, or `--force`.
- SonarCloud issues are resolved only by fixing code, never by marking them false positive or won't-fix.
- Scripts are TypeScript on Node 24, never Python.
- `AGENTS.md` is the only agent instruction file; never add `CLAUDE.md` or tool-specific rule files.

### CI and workflows
- Pin GitHub Actions by full commit SHA with an accurate version comment. Org reusables from `osloer-industries/.github` are pinned `@<full sha> # v0.x.y` (a release tag, never `# main`).
- Every CI job feeds the single `ci-passed` aggregate job, including Workflow security, CodeQL and the SonarCloud zero-issues job. `ci-passed` is the only required status check.
- Only Dependabot patch/minor bumps and patch/minor release PRs auto-merge. Majors (or pre-1.0 breaking changes) never auto-merge; they wait for a human.
- Run the repo's linters, tests and pre-commit checks locally before pushing. The pre-commit hook is never skipped (`--no-verify` is not allowed).
- Push, then stop: do not wait on, watch or poll CI. Failures are handed back to you.

### Pull requests
- Keep PRs focused and reviewable, link the issues they close, and prefer simplification (less code, fewer dependencies, removed duplication).
- Resolve conflicts by merging the base branch in. Never rebase a pushed branch, never force-push, never bypass branch protection.
- A PR is ready for review only when all of these hold: it has no conflicts and is up to date with `main`; every check on the current head is green (pending is not ready); and it has no unresolved review threads, requested changes or open SonarCloud issues. Fix anything short of that yourself. Ask a human only when a real decision or ambiguity needs one.
- Never touch secrets, permissions, repo settings or rulesets without explicit human approval.

## Repository CI layout

Quality gates run on GitHub Actions. Shared security and CodeQL steps call pinned
[org reusable workflows](docs/consuming-org-reusables.md) at
`osloer-industries/.github` (SHA pinned with `# v0.x.y` in each caller; bump via Dependabot `ci(deps)` / `osloer-reusables`).

| Workflow | Purpose |
| --- | --- |
| `CI` | Org reusables: workflow-security, Quality (`node-npm-quality`), CodeQL, Sonar **Analyze** + PR-only zero-open-issues, and aggregate **`ci-passed`** |
| `Dependency review` | Org reusable; high-severity dependency changes on pull requests |
| `Pull request title` | Org reusable semantic PR title |
| `Release` | Org reusable Release Please (`RELEASE_TOKEN`) |

Do not add workflow-level `actions: read` on `CI` (Sonar rule `githubactions:S8264`); the `workflow-security` job
grants `actions: read` at job scope only.