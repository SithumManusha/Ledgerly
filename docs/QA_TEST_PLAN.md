# Ledgerly QA Test Plan

## Purpose

This document describes the quality checks used for Ledgerly, a full-stack personal finance and shared-expense application. The plan focuses on the highest-risk user journeys rather than claiming complete coverage of every possible input or environment.

## Scope

The main scope includes local authentication, password recovery, expense management, budgets, insights, shared groups, production configuration, and the application boundary between the React client, tRPC API, Express server, and PostgreSQL database.

## Test levels

| Test level | What is checked | Evidence in this repository |
| --- | --- | --- |
| Unit and utility testing | Password validation, password strength, analytics calculations, and small reusable functions | Vitest tests in `server/` and `client/src/lib/` |
| Component testing | Selected authentication and theme interactions | Testing Library tests in `client/src/` |
| API and procedure testing | Authentication, logout, password reset, and selected application procedures | Vitest tests for server procedures |
| Integration smoke testing | Client-to-server behavior using the configured database and runtime | Local and production smoke checks |
| Deployment verification | Build output, start command, port binding, environment variables, and migration behavior | Render deployment logs |
| Security smoke testing | Cookie flags, validation boundaries, rate limiting behavior, and token handling | `server/security.test.ts` and `SECURITY.md` |

## Test environments

The application is developed locally with Node.js and pnpm, then deployed as a Node.js web service on Render with PostgreSQL. Optional integrations such as Resend and the AI receipt provider are tested only when their environment variables are configured.

## Entry and exit criteria

Testing begins when the code builds and the target environment variables are available. A change is ready for a portfolio deployment when type checking passes, the automated test suite passes, the production build succeeds, and the affected user journey has been smoke-tested in the deployed application.

A test can also be marked **Blocked** when it depends on an external provider, an unavailable test account, or a hosting feature that is not enabled. Blocked tests should not be reported as passed.

## Defect workflow

For each defect, record the environment, reproducible steps, expected result, actual result, severity, and evidence. After a fix, rerun the original reproduction steps and perform a small regression check around the affected feature.

## Current verification snapshot

The repository has been verified with the following local commands during the current development cycle:

```text
pnpm check    TypeScript check passed
pnpm test     61 tests passed across 10 test files
pnpm build    Production build passed
```

These results describe the recorded verification run; they are not a guarantee that the application is defect-free in every environment.
