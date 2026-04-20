# Security Policy

## Supported Versions

ClaudeShop is in pre-1.0 development. Only the `main` branch is supported for security fixes.

| Version | Supported |
|---------|-----------|
| `main` (latest) | ✅ |
| tagged pre-releases | ⚠️ best effort |
| everything else | ❌ |

## Reporting a Vulnerability

> [!important] Do **not** open a public GitHub issue for security reports.

Please report vulnerabilities privately via:

1. **GitHub Security Advisories** (preferred): `https://github.com/Skill2Cochon/ClaudeShop/security/advisories/new`
2. Or email the maintainers — the address is published in the repo's GitHub profile.

Include:
- Affected version / commit SHA
- Minimal reproduction (curl / script)
- Impact assessment (auth bypass, data exfiltration, DoS, RCE, etc.)
- Suggested fix if you have one

**Disclosure window:** 90 days from confirmed receipt, or earlier coordinated release with the reporter.

## Security Response SLO

| Severity | Triage | Fix | Release |
|---|---|---|---|
| **Critical** (auth bypass, RCE, data exfil) | 24 h | 7 d | next patch |
| **High** (SSRF, injection, cross-tenant) | 72 h | 14 d | next minor |
| **Medium** | 7 d | 30 d | next minor |
| **Low / hardening** | 30 d | best effort | backlog |

## Known Pre-Launch Gaps

See [`AUDIT.md`](./AUDIT.md) for the full pre-1.0 security audit — findings that must be addressed before a public-internet deploy. Key items:

- Admin routes (`/v1/admin/*`) need a role-based auth guard before any public traffic (CRITICAL)
- Webhook subscription URLs now pass an SSRF guard but existing subscriptions should be re-validated on upgrade
- Rate-limit on `/v1/auth/*` endpoints should be tightened below the global 100/min

## Hardening Checklist

Before exposing a ClaudeShop instance to the internet:

- [ ] All `REPLACE_WITH_*` placeholders in `.env.production` are real strong secrets
- [ ] `AUTH_SECRET` is the output of `openssl rand -base64 32`
- [ ] TLS fronts every public port (storefront, admin, api)
- [ ] `SEED_DEMO` is unset or `false`
- [ ] First admin is provisioned via `pnpm --filter @claudeshop/db create-admin`
- [ ] Backups run nightly against `postgres` + `minio-data`
- [ ] Uptime monitor alerts on 3 consecutive health-check failures
- [ ] Dockerfiles use pinned image tags (see [`AUDIT.md`](./AUDIT.md) item #10)
- [ ] Audit trail reviewed weekly during the first month

## Secure-Development Rules (for contributors)

See [`CLAUDE.md`](./CLAUDE.md) § *Development Rules* and § *Anti-Patterns*. In short:

- Zod-validate every API boundary
- Never use `$queryRaw` / `$executeRawUnsafe` with unvalidated input
- Prisma via `withTenant()` only — never bypass RLS scoping
- Server actions for Stripe + secrets — never client-bundled
- `/v1/admin/*` routes must require admin role
- Run `security-review` (agent) before every release candidate
