# Ledgerly

Ledgerly is a personal finance tracker for people who want a simple record of their spending and a clearer way to manage shared bills. It supports private expenses, budgets, savings goals, recurring costs, group bills, settlements, and basic financial reporting.

The project was built as a full-stack TypeScript application. The browser client is a React/Vite app. The server uses Express and tRPC, and Drizzle ORM stores application data in PostgreSQL.

## What it does

- Record, edit, delete, import, and export personal expenses.
- Organize expenses by category and review monthly totals.
- Set category budgets and track progress toward a savings goal.
- Add recurring personal expenses.
- Create groups for roommates, households, or small teams.
- Split shared bills equally, by percentage, by fixed amounts, or by occupancy days.
- Review balances and record settlement transfers.
- Export a shared settlement report as a PDF.
- Scan receipts and parse shared-bill descriptions when an AI provider is configured.
- Send password-reset links through email when Resend is configured.
- Switch between light and dark themes.

## Technology

| Area | Choice |
| --- | --- |
| Client | React 19, TypeScript, Vite |
| Server | Express 4, tRPC 11 |
| Database | PostgreSQL, Drizzle ORM |
| Validation | Zod |
| Authentication | Local email/password sessions with signed HTTP-only cookies |
| Password hashing | bcryptjs |
| Reports | PDFKit |
| Charts | Recharts |
| Testing | Vitest |
| Optional services | Resend email, AI provider, S3-compatible storage |

## Repository layout

```text
client/                 React pages, components, contexts, and styles
drizzle/                PostgreSQL schema and relations
server/                 Express server, tRPC routers, database helpers, and tests
server/_core/           Server bootstrap, authentication, cookies, and integrations
shared/                 Shared constants, types, and password helpers
architecture.mmd        Editable architecture diagram
architecture.png        Rendered architecture diagram
SECURITY.md             Production security notes
package.json            Scripts and dependencies
```

## Local setup

Use Node.js 20 or newer and pnpm. You also need access to a PostgreSQL database.

```bash
git clone <your-repository-url>
cd finance-tracker
pnpm install
```

Create a local `.env` file. Start with `.env.example` and fill in values appropriate for your machine:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ledgerly
JWT_SECRET=use-a-long-random-value-in-real-environments
APP_URL=http://localhost:3000
NODE_ENV=development
PORT=3000
```

Optional services use these variables:

```env
OPENAI_API_KEY=
RESEND_API_KEY=
FROM_EMAIL=
BUILT_IN_FORGE_API_URL=
BUILT_IN_FORGE_API_KEY=
```

Do not commit `.env` or any file containing real credentials.

## Run and test the application

Apply the Drizzle schema to the configured database:

```bash
pnpm db:push
```

Start the development server:

```bash
pnpm dev
```

Before opening a pull request or deploying:

```bash
pnpm check
pnpm test
pnpm build
```

The production server serves the built client and the API from the same Node.js process:

```bash
pnpm start
```

## Authentication and recovery

New users register with a name, email address, and password. Existing users sign in with that email and password. Passwords are stored as bcrypt hashes, not as readable text. Sessions are stored in HTTP-only cookies, so the application does not expose session tokens to browser JavaScript.

The **Forgot password** screen sends a one-time reset link when a matching local account exists. The reset token is stored as a SHA-256 hash, expires after 30 minutes, and is invalidated after use. Set `RESEND_API_KEY`, `FROM_EMAIL`, and `APP_URL` in production to send real messages.

## Production deployment

Ledgerly is designed to run as one Node.js web service with a PostgreSQL database. Render is the simplest fit for the current Express server because it can run the application as a normal Node.js service.

Use these commands on the hosting platform:

```text
Build: pnpm install --frozen-lockfile && pnpm build
Start: pnpm start
```

Set `DATABASE_URL`, `JWT_SECRET`, `APP_URL`, and `NODE_ENV=production` in the host's secret settings. After the first deploy, apply the schema with:

```bash
pnpm db:push
```

Read `SECURITY.md` before making the application public.

## 🚀 Live Demo & Links

- **Live Application**: [https://ledgerly.onrender.com](https://ledgerly.onrender.com)
- **GitHub Repository**: [https://github.com/SithumManusha/Ledgerly](https://github.com/SithumManusha/Ledgerly)
- **Developer**: [Sithum Manusha](https://github.com/SithumManusha)

## 📄 License & Security

This project is open-source and built for portfolio demonstration. For security implementation details, review [SECURITY.md](SECURITY.md).
