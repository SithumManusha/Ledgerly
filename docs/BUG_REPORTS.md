# Ledgerly Bug Investigation Notes

## BUG-001 — Registration failed in the first Render deployment

**Environment:** Render production, Chromium, PostgreSQL-backed Node.js service.

**Severity:** High, because registration could not complete in the deployed environment.

**Steps to reproduce:**

1. Open the Ledgerly registration form in the deployed application.
2. Enter a valid name, email address, and strong password.
3. Submit the form.

**Expected result:** A new account is created and the user is redirected to the dashboard.

**Observed result:** The request failed while querying the `users` table. The frontend initially displayed a JSON parsing message because the server returned an error response instead of the expected JSON payload.

**Investigation:** Render logs and the repository migration history showed that the application schema was configured for PostgreSQL while the original migration files were generated in a different SQL dialect. Subsequent deployment attempts also exposed an interactive Drizzle conflict prompt that could not run in Render's non-interactive process.

**Resolution:** A clean PostgreSQL migration directory was added, the Render startup path was changed to use a deterministic database bootstrap script, and the script was made safe for the already-created `user_role` enum and tables. The script records an applied migration marker so it does not repeat the same bootstrap on every restart.

**Verification:** Render logs later showed the migration marker was already applied and the server started on port 10000. The production dashboard loaded successfully after deployment.

## BUG-002 — Render migration command required an interactive terminal

**Environment:** Render Free Web Service.

**Observed result:** `drizzle-kit push --force` reached the database but failed with `Interactive prompts require a TTY terminal` while resolving a column conflict.

**Resolution:** The interactive push command was removed from the production start path. The deterministic bootstrap script now applies the committed PostgreSQL SQL and prints the exact failed statement if a future database issue occurs.

## Reporting guidance

These records describe defects found during development and deployment investigation. They are included as evidence of the test-and-debug process, not as a claim that every possible production defect has been eliminated.
