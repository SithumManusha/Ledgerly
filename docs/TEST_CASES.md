# Ledgerly Manual Test Cases

These cases are a practical smoke and regression checklist for the main Ledgerly workflows. Replace the status with the result from the environment being tested; do not mark an external integration as passed without testing it.

| ID | Area | Preconditions | Steps | Expected result | Status |
| --- | --- | --- | --- | --- | --- |
| AUTH-001 | Registration | User is signed out | Submit a valid name, email, and strong password | Account is created and the dashboard opens | Passed in production smoke test |
| AUTH-002 | Registration validation | User is on the registration form | Submit an invalid email or weak password | A clear validation message is shown and no account is created | Covered by automated tests |
| AUTH-003 | Duplicate registration | An account already exists for the email | Register with the same email | The request is rejected without exposing sensitive account details | To verify |
| AUTH-004 | Login | A valid local account exists | Enter valid credentials | User is authenticated and redirected to the dashboard | Passed |
| AUTH-005 | Invalid login | A valid local account exists | Enter an incorrect password | Login is rejected with a generic error | Covered by automated tests |
| AUTH-006 | Logout | User is signed in | Select Sign out | Session is cleared and protected pages are no longer accessible | Covered by automated tests |
| AUTH-007 | Password recovery | Resend is configured | Request a reset link for a local account | A reset email is sent and the token is single-use | Requires provider verification |
| AUTH-008 | Password recovery security | A reset token is expired or already used | Open the reset link | The token is rejected and the password is not changed | Covered by automated tests |
| EXP-001 | Add expense | User is signed in | Add a valid amount, date, description, and category | Expense is saved and overview totals update | To verify |
| EXP-002 | Edit and delete expense | At least one expense exists | Edit a field, save, then delete the expense | The list and totals reflect each change | To verify |
| EXP-003 | Invalid expense input | User is signed in | Submit an invalid amount or empty required field | Validation prevents an invalid record from being saved | To verify |
| BUD-001 | Budget creation | User is signed in | Create a category budget for the current month | Budget appears and budget health reflects the limit | To verify |
| INS-001 | Insights | User has expense data | Open Insights | Charts and totals match the underlying transactions | To verify |
| SHR-001 | Shared expense | User is signed in | Create a group and add a shared bill | Group and bill data are visible to the appropriate participants | To verify |
| UI-001 | Navigation | User is signed in | Open each sidebar item | The correct page loads and the active item is visually clear | Passed after production deploy |
| UI-002 | Responsive layout | Application is available | Test desktop and mobile viewport sizes | Navigation and forms remain usable without clipped controls | To verify |
| DEP-001 | Production startup | Render has the required environment variables | Deploy the latest main-branch commit | Database bootstrap completes and the service binds to the Render port | Passed in Render logs |

## Recording a result

Use a date, environment, browser, and short evidence note when recording a result. A useful entry looks like `Passed — Render production — Chromium — 2026-08-27 — registration and dashboard smoke test completed`.
