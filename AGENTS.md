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
