# Agent Guidelines

These instructions apply to all human and automated contributors.

## Priorities

1. Protect HomeExchange session data and user privacy.
2. Keep requests restricted to trusted HomeExchange API origins.
3. Preserve exact dependency versions and the committed npm lockfile.
4. Add or update tests for every behavior change.

## Required checks

Run `npm run check` before submitting a change. When dependencies change, also run `npm audit --omit=dev` and commit the updated `package-lock.json`.

## Conventions

- Use Node.js 22, npm, strict TypeScript, and CommonJS modules.
- Use Oxlint for linting and Vitest for unit tests.
- Keep all dependency versions exact, without `~` or `^`.
- Never commit `session.json`, HAR captures, credentials, tokens, or private keys.
- Prefer open standards and provider-neutral instructions.
- Make focused changes and do not rewrite unrelated files.
