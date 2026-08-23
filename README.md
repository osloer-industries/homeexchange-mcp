<div align="center">

# 🏠 homeexchange-mcp

**An unofficial MCP server for [HomeExchange](https://www.homeexchange.com)**

Search homes · Read messages · Manage favourites · All from your AI client

[![Version](https://img.shields.io/github/v/release/osloer-industries/homeexchange-mcp?color=FF6B35&label=version)](https://github.com/osloer-industries/homeexchange-mcp/releases)
[![License: MIT](https://img.shields.io/badge/license-MIT-FF6B35)](LICENSE)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=osloer-industries_homeexchange-mcp&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=osloer-industries_homeexchange-mcp)
[![Unofficial](https://img.shields.io/badge/status-unofficial-grey)](https://github.com/osloer-industries/homeexchange-mcp#disclaimer)

> **Unofficial project.** Not affiliated with or endorsed by HomeExchange SAS.
> Personal use only — see [disclaimer](#disclaimer).

</div>

---

## What you can do

Once connected, ask your AI client things like:

- *"Find homes in Lisbon for 2 guests in July, GuestPoints only"*
- *"Show me my unanswered messages"*
- *"Send a message to conversation 12345 asking about parking"*
- *"What homes have I favourited?"*
- *"Show the availability calendar for home 1950607"*

**20 tools across three categories:**

| Category | Tools |
|----------|-------|
| 🔍 **Search & discovery** | `search_homes` · `get_home` · `get_home_calendar` · `get_recommendations` · `list_my_homes` · `list_favorites` · `add_favorite` · `remove_favorite` · `list_saved_searches` |
| 💬 **Messaging** | `list_conversations` · `get_conversation` · `get_messages` · `get_exchange_request` · `send_message` · `start_conversation` · `pre_approve_exchange` · `archive_conversation` |
| 👤 **Users** | `get_user_profile` · `get_user_ratings` · `get_user_achievements` |

---

## How it works

```
  npm run login
       │
  Browser opens → you log in once
       │
  session.json  (token + cookies, stays local)
       │
  npm run mcp
       │
  MCP Server (local, stdio)
       │
  ┌────┴──────────────────────────────┐
  │                 │                 │
  search &       messaging          users
  discovery      (8 tools)        (3 tools)
  (9 tools)          │                │
       │             └────────┬───────┘
       └────────────────┘
                 │
     api.homeexchange.com
     bff.homeexchange.com
```

Auth is captured once via your real browser session — no credentials stored in code. The MCP server runs locally and makes direct API calls on your behalf. Works with any MCP-compatible client.

---

## Quick start

### 1. Install

```bash
npm ci
npx playwright install chromium
```

### 2. Capture your session

```bash
npm run login
```

A browser opens. Log in to HomeExchange, then press **Ctrl+C**. Your session is saved locally to `session.json` (git-ignored).

> Tokens expire after a few days. Re-run `npm run login` when tools start returning 401s.

### 3. Start the MCP server

```bash
npm run mcp
```

---

## Client setup

Works with any MCP client that supports stdio transport.

### Claude Desktop

`~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "homeexchange": {
      "command": "npx",
      "args": ["ts-node", "src/mcp.ts"],
      "cwd": "/path/to/homeexchange-mcp"
    }
  }
}
```

### Claude Code

```bash
claude mcp add homeexchange -- npx ts-node src/mcp.ts
```

### Cursor

`~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "homeexchange": {
      "command": "npx",
      "args": ["ts-node", "src/mcp.ts"],
      "cwd": "/path/to/homeexchange-mcp"
    }
  }
}
```

### Zed

`.zed/settings.json`:

```json
{
  "context_servers": {
    "homeexchange": {
      "command": { "path": "npx", "args": ["ts-node", "src/mcp.ts"] }
    }
  }
}
```

---

## Tool reference

### 🔍 Search & discovery

#### `search_homes`
Search listings by location, dates, guests, and exchange type.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `location` | string | No | — | City, region, or country |
| `checkin` | string | No | — | `YYYY-MM-DD` |
| `checkout` | string | No | — | `YYYY-MM-DD` |
| `guests` | number | No | — | Number of guests |
| `exchange_type` | string | No | — | `GuestPoints` · `simultaneous` · `non_simultaneous` |
| `home_type` | string | No | — | `house` · `apartment` · `other` |
| `limit` | number | No | `20` | Results per page (max 36) |
| `offset` | number | No | `0` | Pagination offset |

#### `get_home`
Full details for a listing.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `home_id` | string | **Yes** | Numeric home ID |

#### `get_home_calendar`
Availability calendar — blocked and open dates for a home.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `home_id` | string | **Yes** | Numeric home ID |

#### `get_recommendations`
Personalised picks based on your profile and history.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `limit` | number | No | `8` | Number of results |

#### `list_my_homes`
Your own listings. No parameters.

#### `list_favorites`
Your saved homes.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `limit` | number | No | `20` | Number of results |

#### `add_favorite`
Save a home to your favourites.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `home_id` | string | **Yes** | Home ID |

#### `remove_favorite`
Remove a home from your favourites.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `home_id` | string | **Yes** | Home ID |

#### `list_saved_searches`
Your saved search filters.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `limit` | number | No | `100` | Number of results |

---

### 💬 Messaging

#### `list_conversations`
Your conversation inbox.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `filter` | string | No | `ALL` | `ALL` · `UNANSWERED` · `ARCHIVED` |
| `limit` | number | No | `20` | Threads to return |
| `after` | string | No | — | Pagination cursor from previous response |

#### `get_conversation`
Extended information about a conversation, including exchange details.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `conversation_id` | string | **Yes** | Conversation ID |

#### `get_messages`
All messages in a conversation thread.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `conversation_id` | string | **Yes** | Conversation ID |

#### `get_exchange_request`
Exchange request details attached to a conversation.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `conversation_id` | string | **Yes** | Conversation ID |

#### `send_message`
Reply in an existing conversation.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `conversation_id` | string | **Yes** | Conversation ID |
| `text` | string | **Yes** | Message text |

#### `start_conversation`
Open a new conversation about a home.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `home_id` | string | **Yes** | The home you're enquiring about |
| `text` | string | **Yes** | Opening message |

#### `pre_approve_exchange`
Pre-approve an exchange request.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `conversation_id` | string | **Yes** | Conversation ID |

#### `archive_conversation`
Archive a conversation.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `conversation_id` | string | **Yes** | Conversation ID |

---

### 👤 Users

#### `get_user_profile`
A member's public profile.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `user_id` | string | **Yes** | Numeric user ID |

#### `get_user_ratings`
Ratings left for a member.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `user_id` | string | **Yes** | Numeric user ID |

#### `get_user_achievements`
Achievements earned by a member.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `user_id` | string | **Yes** | Numeric user ID |

---

## Scripts

| Script | Description |
|--------|-------------|
| `npm run login` | Capture auth session via browser ← start here |
| `npm run mcp` | Start the local MCP server |
| `npm run record` | Full network recorder with HAR capture (API exploration) |
| `npm run analyze` | Analyze a `.har` file → `api-map.json` |
| `npm run build` | Compile TypeScript |
| `npm run test` | Run unit tests |
| `npm run test:coverage` | Run tests with the 80% coverage gate |
| `npm run check` | Lint, typecheck, coverage, and build |

---

## Project layout

```
src/
  login.ts          browser auth capture
  record.ts         full network recorder with HAR output
  analyze.ts        HAR → api-map.json analysis
  api.ts            authenticated HTTP client
  mcp.ts            MCP stdio server
  tools/
    search.ts       9 search & discovery tools
    messaging.ts    8 messaging tools
    user.ts         3 user tools
```

---

## Roadmap

Tracked as GitHub Issues — upvote or comment to influence priority:

- [#9 Calendar integration](https://github.com/osloer-industries/homeexchange-mcp/issues/9) — query and update availability, surface conflicts across requests
- [#10 Remote MCP](https://github.com/osloer-industries/homeexchange-mcp/issues/10) — hosted endpoint, no local setup required
- [#11 Token expiry detection](https://github.com/osloer-industries/homeexchange-mcp/issues/11) — auto-prompt on 401 *(good first issue)*
- [#12 Saved search alerts](https://github.com/osloer-industries/homeexchange-mcp/issues/12) — notify when new homes match your saved searches

---

## Contributing

Ideas, bug reports, and pull requests are welcome.

See [CONTRIBUTING.md](CONTRIBUTING.md) for the complete development, quality, privacy, and organization-rule requirements.

**Got a feature idea or found a bug?** [Open an issue](https://github.com/osloer-industries/homeexchange-mcp/issues/new) — describe what you were trying to do and what happened (or didn't).

**Want to contribute code?**

1. Fork the repo and create a branch from `main`
2. Make your changes — keep commits [conventional](https://www.conventionalcommits.org/) (`fix:`, `feat:`, `chore:` etc.)
3. Open a pull request — CI must pass before merge

**Good first issues** are tagged [`good first issue`](https://github.com/osloer-industries/homeexchange-mcp/labels/good%20first%20issue) — start there if you're new to the codebase.

> Note: This project reverse-engineers a private API. New tools may break if HomeExchange changes their endpoints. Please check existing issues before reporting an API breakage.

## Security

Report vulnerabilities privately using the process in [SECURITY.md](SECURITY.md). Never include session files, cookies, access tokens, private messages, or member data in an issue or pull request.

---

## Releases

Release Please collects conventional commits on `main` into a release pull request. A maintainer reviews that pull request and merges it when the project is ready to publish. Merging it updates `CHANGELOG.md`, `package.json`, and `package-lock.json`, then creates the version tag and GitHub Release.

Before `1.0.0`, `feat:` and breaking changes increase the minor version, while `fix:`, `perf:`, and `revert:` increase the patch version. The release workflow uses the `RELEASE_TOKEN` repository secret so its pull requests receive the normal required CI checks. That fine-grained token must have access only to this repository, permission to write contents and pull requests, and an expiration that complies with the organization policy.

---

## Disclaimer

This is an **unofficial, community project** with no affiliation with HomeExchange SAS.

- Uses your own HomeExchange account credentials, exactly as your browser does
- **Personal, non-commercial use only** — not for scraping, reselling, or commercial exploitation of HomeExchange data
- Subject to [HomeExchange's Terms of Service](https://www.homeexchange.com/en/page/terms)
- The HomeExchange API is private and undocumented — endpoints may change without notice

**The intent is to build a genuinely useful tool for the HomeExchange community, and ideally to partner with HomeExchange to do this officially.** If you work at HomeExchange and are interested in collaborating on a proper integration, please [open an issue](https://github.com/osloer-industries/homeexchange-mcp/issues) or get in touch.

---

## License

[MIT](LICENSE) — personal and non-commercial use.

*HomeExchange® is a registered trademark of HomeExchange SAS. This project is independent and not endorsed by HomeExchange SAS.*
