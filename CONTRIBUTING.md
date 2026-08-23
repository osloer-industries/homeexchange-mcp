# Contributing

Thank you for improving homeexchange-mcp.

## Development

1. Install Node.js 22.23.1.
2. Run `npm ci`.
3. Create a focused branch from `main`.
4. Add tests with every behavior change.
5. Run `npm run check` and `npm audit --omit=dev`.
6. Open a pull request using the provided template.

The coverage gate requires at least 80% for branches, functions, lines, and statements. Dependency versions must remain exact, and `package-lock.json` must be committed whenever dependencies change.

Use conventional commit prefixes such as `feat:`, `fix:`, `docs:`, `test:`, `refactor:`, and `chore:`. Organization rules require pull request review, successful checks, squash merging, and linear history on `main`.

## Security and privacy

This project handles authenticated browser session data. Never include real sessions, cookies, tokens, member data, private messages, or captured network traffic in source code, fixtures, issues, or pull requests. Use synthetic examples and redact identifiers.

Report vulnerabilities using the private process in [SECURITY.md](SECURITY.md).
