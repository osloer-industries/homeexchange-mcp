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

### Local MCP validation

Use `npm run test:mcp` to verify the built server through its real local stdio
MCP connection. This is credential-free and must not make network requests.
Use `npm run test:mcp -- --live` only when a current local `session.json` is
available and a read-only account check is intended. It must never print API
responses or session data. See the local-testing section in `README.md`.

## CI and reusable workflows

Quality gates run on GitHub Actions. Shared security and CodeQL steps call pinned
[org reusable workflows](docs/consuming-org-reusables.md) at
`osloer-industries/.github` (SHA pinned in each caller; bump via Dependabot `ci(deps)`).

| Workflow | Purpose |
| --- | --- |
| `CI` | `workflow-security` (org reusable: actionlint + zizmor) plus repo jobs for audit, `npm run check`, and SonarCloud |
| `CodeQL` | Org reusable JavaScript/TypeScript analysis (public repo Code Scanning upload) |
| `Dependency review` | High-severity dependency changes on pull requests |
| `Pull request title` | Conventional Commits title validation |
| `Release` | Release Please (uses org `RELEASE_TOKEN`) |

Before opening a pull request, run `npm run check` locally. Do not add workflow-level
`actions: read` on `CI` (Sonar rule `githubactions:S8264`); the `workflow-security` job
grants `actions: read` at job scope only.
