# Ledgerly

[![Live Demo](https://img.shields.io/badge/Live_Demo-Online-2ea44f?logo=render)](https://ledgerly-mbcd.onrender.com)
[![CI](https://github.com/SithumManusha/Ledgerly/actions/workflows/ci.yml/badge.svg)](https://github.com/SithumManusha/Ledgerly/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

Ledgerly is a personal finance and shared-expense tracker. It gives users a single place to record expenses, set budgets, review spending patterns, and split group bills. The application is built as a full-stack TypeScript project and is deployed as a Node.js service with PostgreSQL.

**Live demo:** [ledgerly-mbcd.onrender.com](https://ledgerly-mbcd.onrender.com)

**Repository:** [github.com/SithumManusha/Ledgerly](https://github.com/SithumManusha/Ledgerly)

## Features

Ledgerly currently supports the following workflows:

- Add, edit, delete, import, and export personal expenses.
- Organise expenses by category and review monthly totals.
- Create category budgets and track progress toward a savings goal.
- Add recurring personal expenses.
- Create groups for households, roommates, or small teams.
- Split shared bills equally, by percentage, by fixed amount, or by occupancy days.
- Review balances, record settlements, and export a shared settlement report as a PDF.
- Review spending insights and currency conversions.
- Scan receipts and parse statement data when the optional AI provider is configured.
- Request password recovery by email when Resend is configured.
- Switch between light and dark themes.

Optional services are intentionally configuration-based. The core application can run without the AI, email, storage, and OAuth integrations.

## Technology

| Area | Technology |
| --- | --- |
| Client | React 19, TypeScript, Vite |
| Server | Express 4, tRPC 11 |
| Database | PostgreSQL with Drizzle ORM |
| Validation | Zod |
| Authentication | Local email/password authentication with signed HTTP-only session cookies |
| Password hashing | bcryptjs |
| Reports | PDFKit |
| Charts | Recharts |
| Testing | Vitest, Testing Library |
| Optional services | Resend, an OpenAI-compatible provider, and S3-compatible storage |

## Repository layout

```text
client/                 React pages, components, contexts, and styles
server/                 Express server, tRPC routers, database helpers, and tests
server/_core/           Server startup, sessions, cookies, and integrations
shared/                 Shared constants, types, and password helpers
drizzle/                Schema and relation definitions
drizzle-pg/             PostgreSQL migration SQL and metadata
scripts/                Production database bootstrap utilities
docs/                   QA plan, test cases, bug reports, and release checklist
architecture.mmd        Editable architecture diagram
architecture.png        Rendered architecture diagram
SECURITY.md             Production security notes
```

## Local setup

Use Node.js 20 or newer, pnpm, and a PostgreSQL database. Clone the repository and install the dependencies:

```bash
git clone https://github.com/SithumManusha/Ledgerly.git
cd Ledgerly
pnpm install
```

Create a local `.env` file based on `.env.example`. The values below are examples for local development only:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ledgerly?sslmode=require
JWT_SECRET=use-a-long-random-value-in-real-environments
APP_URL=http://localhost:3000
NODE_ENV=development
PORT=3000
```

Optional integrations use the following variables:

```env
OPENAI_API_KEY=
BUILT_IN_FORGE_API_URL=
BUILT_IN_FORGE_API_KEY=
RESEND_API_KEY=
FROM_EMAIL=
VITE_APP_ID=ledgerly
OAUTH_SERVER_URL=
OWNER_OPEN_ID=
```

Never commit `.env`, database URLs, API keys, reset tokens, or exported financial data. The checked-in `.env.example` contains placeholders only.

## Running and testing locally

The project scripts are:

```bash
pnpm dev       # Start the development server
pnpm check     # Run the TypeScript check
pnpm test      # Run the Vitest suite
pnpm build     # Build the client and server for production
pnpm start     # Bootstrap the database and start the production server
```

For a local database, `pnpm db:push` applies the configured PostgreSQL migration path. The production start command also runs the deterministic bootstrap in `scripts/bootstrap-db.mjs` before starting the server, so a deployed service can initialise or verify its schema without an interactive terminal.

Before opening a pull request or deploying a change, run:

```bash
pnpm check
pnpm test
pnpm build
```

## Authentication and password recovery

Users can create a local account with a name, email address, and password, then sign in with those credentials. Passwords are hashed with bcrypt. In production, the session token is stored in an HTTP-only cookie with bounded lifetime and `SameSite=Lax` settings.

The Forgot password flow creates a random, single-use token with a 30-minute expiry and stores only its SHA-256 hash in the database. When Resend is configured, the user receives a recovery link by email. The current portfolio demo also supports an immediate recovery path in the interface; for a sensitive production deployment, the email-only path should be preferred and tested with the configured mail provider.

Google/OAuth login is optional and requires the OAuth environment variables to be configured. It is not required for local email/password registration.

## QA and verification

The repository includes automated tests for authentication, security-related behavior, analytics utilities, selected UI interactions, password recovery, and server procedures. The current recorded verification run passed 61 tests across 10 test files, followed by the TypeScript check and production build.

Those results describe the tested scope at the time of the run; they are not a claim that every possible input, browser, integration, or production failure has been covered. The manual test plan, test-case matrix, deployment bug investigation, and release checklist are available here:

- [QA test plan](docs/QA_TEST_PLAN.md)
- [Manual test cases](docs/TEST_CASES.md)
- [Bug investigation notes](docs/BUG_REPORTS.md)
- [Release checklist](docs/RELEASE_CHECKLIST.md)

## Production deployment on Render

Ledgerly runs on Render as a normal Node.js web service connected to a hosted PostgreSQL database.

Recommended service settings are:

| Setting | Value |
| --- | --- |
| Branch | `main` |
| Build command | `pnpm install --frozen-lockfile && pnpm build` |
| Start command | `pnpm start` |
| Required variables | `DATABASE_URL`, `JWT_SECRET`, `APP_URL`, `NODE_ENV=production` |
| Optional variables | Resend, OAuth, AI, and storage variables when those features are enabled |

The `pnpm start` command runs the PostgreSQL bootstrap script before the server starts. Render does not need a web shell for this process. After changing the schema or deployment configuration, review the Render deploy logs and confirm that the database step completes before the service binds to the configured port.

The live deployment is available at [https://ledgerly-mbcd.onrender.com](https://ledgerly-mbcd.onrender.com). Render's free instances can sleep after inactivity, so the first request after a quiet period may take longer than usual.

## Security notes

Read [SECURITY.md](SECURITY.md) before making the application public. The project includes input validation, bcrypt password hashing, HTTP-only session cookies, rate limiting on authentication-related endpoints, single-use recovery tokens, and authenticated data access checks. These controls reduce common risks; they do not make any web application impossible to compromise.

Use a unique production `JWT_SECRET`, keep all credentials in the hosting provider's secret manager, configure database backups, and rotate any secret that appears in a commit, log, screenshot, or browser response.

## Licence

Ledgerly is released under the [MIT License](LICENSE).
