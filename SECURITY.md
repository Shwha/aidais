# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in AIDAIS, please report it responsibly.

**Do NOT open a public GitHub issue for security vulnerabilities.**

Instead, please email the maintainers directly or use GitHub's private vulnerability reporting feature:

1. Go to the [Security tab](https://github.com/shwha/aidais/security) of this repository
2. Click "Report a vulnerability"
3. Provide a detailed description of the vulnerability

We will acknowledge your report within 48 hours and work to address verified vulnerabilities promptly.

## Scope

The following are in scope for security reports:

- API key exposure or leakage
- WebSocket injection or message spoofing
- Cross-site scripting (XSS) in the web frontend or Chrome extension
- Server-side request forgery (SSRF)
- Authentication or authorization bypasses
- Dependency vulnerabilities with known exploits

## Security Practices

This project follows these security practices:

- **No secrets in source control** — API keys stored only in `.env` (gitignored)
- **Input validation** — All WebSocket messages validated with Zod schemas
- **CORS restrictions** — Strict origin allowlist, no wildcards
- **Content Security Policy** — Restrictive CSP headers on all responses
- **Rate limiting** — Per-IP rate limits on connections and messages
- **Structured logging** — No PII, API keys, or audio content in logs
- **Dependency auditing** — Regular `pnpm audit` checks
- **Non-root Docker** — Container runs as unprivileged user
- **TypeScript strict mode** — Maximum type safety with `noUncheckedIndexedAccess`

## Supported Versions

| Version | Supported |
| ------- | --------- |
| 0.1.x   | Yes       |
