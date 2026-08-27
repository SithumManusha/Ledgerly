# Ledgerly security notes

Ledgerly is a personal-finance application, so the safest default is to fail closed. A deployment is not considered ready until it has a real PostgreSQL database, HTTPS, a unique session secret, and verified backups.

## Production requirements

Set `NODE_ENV=production`, provide `DATABASE_URL`, and provide a randomly generated `JWT_SECRET` or `SESSION_SECRET` of at least 32 characters. The server now refuses to start in production when these values are absent instead of silently using development defaults.

Keep all secrets in the deployment provider's secret manager. Do not commit `.env`, database URLs, API keys, reset tokens, or exported financial data to Git. Rotate a secret immediately if it appears in a commit, log, screenshot, or browser response.

## Authentication protections

Local passwords are stored as bcrypt hashes. Session tokens are issued only as HTTP-only cookies in production; the development preview bearer-token fallback is disabled in production. Sessions use a bounded lifetime and `SameSite=Lax`, and the server applies a rate limit to login, registration, and password-reset attempts.

Password-reset tokens are random, single-use, hashed before storage, and expire. Recovery responses should remain neutral so that an attacker cannot use the endpoint to discover registered email addresses.

## Authorization expectations

Every procedure that reads or changes a user's personal data must use the authenticated user ID in its database query. Every shared-group procedure must verify group membership and the required role before returning or changing group data. This rule must also be applied to invitations, recurring shared bills, uploaded evidence, and settlement reports.

## Deployment checklist

1. Run `pnpm check`, `pnpm test`, and `pnpm build`.
2. Apply the Drizzle schema with `pnpm db:push` against the production `DATABASE_URL`.
3. Confirm that the public health endpoint exposes no secrets or internal stack traces.
4. Verify login, logout, password reset, tenant isolation, and authorization failures using two separate test accounts.
5. Confirm HTTPS is active and that the session cookie has `HttpOnly`, `Secure`, `SameSite=Lax`, and a bounded `Max-Age`.
6. Configure database backups, restore testing, monitoring, and log redaction.
7. Keep dependencies patched and review authentication or authorization changes before deployment.

No web application can honestly promise that nobody can ever hack it. These controls reduce common risks, but security also depends on the hosting provider, database configuration, dependency updates, secret handling, backups, monitoring, and ongoing review.
