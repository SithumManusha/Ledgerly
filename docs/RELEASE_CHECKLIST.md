# Ledgerly Release Checklist

Use this checklist before presenting a new build or deploying a change to the live demo.

## Code quality

- [ ] Run `pnpm check` and review TypeScript errors.
- [ ] Run `pnpm test` and record the number of passed tests.
- [ ] Run `pnpm build` and confirm the production bundle completes.
- [ ] Review the changed files and remove debug output or test credentials.

## Functional smoke test

- [ ] Register a new test account.
- [ ] Sign in and sign out.
- [ ] Add an expense and confirm the overview updates.
- [ ] Open Transactions, Budgets, and Insights.
- [ ] Check the primary navigation and active state.
- [ ] Test the main layout at desktop and mobile viewport sizes.

## Authentication and security checks

- [ ] Confirm passwords are never displayed or stored as readable text.
- [ ] Confirm protected pages require an authenticated session.
- [ ] Check that cookies use the expected secure flags in production.
- [ ] Test invalid credentials and invalid form input.
- [ ] If password recovery is enabled, test a real reset email and an expired or reused token.
- [ ] Confirm `.env` files, database URLs, API keys, and private user data are not committed.

## Deployment checks

- [ ] Confirm the expected commit is deployed on Render.
- [ ] Confirm the database bootstrap/migration step completes.
- [ ] Confirm the service binds to the configured Render port.
- [ ] Check the live URL after deployment.
- [ ] Record any blocked checks that depend on optional services such as OAuth, Resend, or AI receipt scanning.

## Evidence to keep in the portfolio

Keep a redacted test-result screenshot, a representative bug report, the live demo link, and the GitHub repository link. Never include passwords, tokens, database URLs, or private financial records in the evidence.
