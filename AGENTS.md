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

## Quality, release, and trusted origins

- Use Node.js 22 and npm. Keep exact dependency versions and commit the npm
  lockfile with dependency changes. Run `npm run check` before submission and
  `npm audit --omit=dev` when dependencies change.
- `npm run typecheck` is authoritative. Oxlint adds type-aware promise checks,
  cycles, focused-test prevention, and complexity controls, but does not
  replace TypeScript compiler diagnostics.
- Keep branch, function, line, and statement coverage at or above 80%.
- Use Conventional Commit pull request titles. Release Please uses the
  organization `RELEASE_TOKEN`; never bypass its reviews or checks.
- Do not weaken action SHA pins, minimal workflow permissions, timeouts,
  concurrency, production audits, CodeQL, dependency review, Dependabot, or
  Sonar workflows. Rulesets and branch protection are manual only.
- Send session credentials only to the trusted HomeExchange API and BFF
  origins. Validate every URL before making a request. Do not broaden the
  trusted-origin allowlist without explicit review.

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
