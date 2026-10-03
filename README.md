# Ledgerly — Autonomous AI Financial Intelligence & Collaborative Ledger

[![Live Demo](https://img.shields.io/badge/Live_Demo-Online-2ea44f?logo=render)](https://ledgerly-mbcd.onrender.com)
[![Vitest Passing](https://img.shields.io/badge/Vitest-68%2F68_Passing-success?logo=vitest)](server/intelligence.test.ts)
[![TypeScript Strict](https://img.shields.io/badge/TypeScript-Strict_100%25-blue?logo=typescript)](tsconfig.json)
[![CI](https://github.com/SithumManusha/Ledgerly/actions/workflows/ci.yml/badge.svg)](https://github.com/SithumManusha/Ledgerly/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**Ledgerly** is a production-grade, enterprise-ready financial intelligence platform and collaborative expense tracker. Beyond conventional CRUD budgeting applications, Ledgerly integrates **Autonomous AI Financial Intelligence**, real-time predictive runway simulations, spending velocity anomaly alerts, and a cryptographically sound, event-driven collaborative ledger with Server-Sent Events (SSE).

- **🌐 Live Production URL:** [https://ledgerly-mbcd.onrender.com](https://ledgerly-mbcd.onrender.com)
- **💻 GitHub Repository:** [https://github.com/SithumManusha/Ledgerly](https://github.com/SithumManusha/Ledgerly)
- **📐 Architecture:** React 19, TypeScript, tRPC 11, Express 4, PostgreSQL (Drizzle ORM), Recharts, Server-Sent Events (SSE)

---

## 🚀 Key Modules & Autonomous Intelligence

### 1. 🧠 Autonomous AI Financial Copilot & Health Scoring (`/copilot`)
- **Composite Financial Health Engine (0–100 Score & A+ to D Grade):** Synthesizes budget adherence, liquid savings buffer, and monthly burn stability into an actionable health gauge.
- **Velocity Spike & Spending Anomaly Detection:** Real-time algorithmic detection that flags category expenditure surging >25% above historical baselines.
- **Budget Breach Forecasts:** Extrapolates current daily burn velocity to predict exact days until category budget exhaustion.
- **Natural Language Financial Q&A:** Grounded context-aware copilot providing immediate answers (e.g., *"Can I afford a major vacation next month?"*, *"How do I optimize my savings velocity?"*).

### 2. 🎛️ Interactive "What-If" Financial Runway Simulator (`/copilot`)
- **Dynamic Stress-Testing Sliders:** Simulate discretionary spending reductions (0%–50%), one-off capital purchases (LKR), and monthly income shifts.
- **Runway & Net Delta Projections:** Projects runway extension/depletion in net months, recalculates adjusted monthly burn, and issues dynamic health warnings (Healthy, Warning, Critical).
- **Comparative Cash-Flow Curves:** Visualizes a 6-month projected comparative expenditure timeline using Recharts.

### 3. 🔔 Real-Time Notification Bell & Event Alerts (Global Header)
- **Instant Reactive Notification Center:** Dropdown notification center mounted in the navigation bar with animated unread count badges.
- **Categorized Event Push:** Pushes real-time alerts for spending anomalies, budget overages, debt settlement receipts, and group invitations with relative timestamps.
- **Read State Management:** Single-click "Mark all as read" and individual notification dismissal.

### 4. 📜 Live Activity Audit Stream & Shared Ledger (`/shared`)
- **Immutable Collaborative Audit Trail:** Chronological event timeline recording bill submissions, AI split allocations, payment proof attachments, and verified settlements.
- **Real-Time SSE Synchronization:** Leverages Server-Sent Events (`/api/events?groupId=...`) for instant, live updates across all connected group members without page refreshes.
- **Flexible Bill Splitting Algorithms:** Supports equal division, custom percentages, fixed amounts, and occupancy-day weighting (ideal for boarding houses/roommates).
- **PDF Settlement Export:** Server-side deterministic PDF report generation using PDFKit with recipient balance matrices and verification stamps.

### 5. 📊 Core Financial Command Center
- **Overview Dashboard (`/`):** Real-time spending distribution, category donut charts, daily rhythm heatmaps, and Month-over-Month (MoM) trajectories.
- **Dedicated AI Copilot Cockpit (`/copilot`):** Autonomous 0–100 Health Score gauge, velocity anomaly alerts, What-If runway stress-testing sliders, and conversational guidance.
- **Spending Analytics & Insights (`/insights`):** Granular burn analytics, category distributions, daily rhythm charts, and instant link to the Copilot.
- **Transactions Ledger (`/transactions`):** Full multi-currency ledger (LKR, USD, EUR, GBP) with receipt capture, CSV import/export, and smart categorization.
- **Budget Limits & Guardrails (`/budgets`):** Visual threshold progress bars and category cap management.
- **Recurring Commitments (`/recurring`):** Proactive tracking for recurring utility bills, subscriptions, and savings goal targets.

---

## 🛠️ Technology Stack

| Layer | Technologies |
| --- | --- |
| **Frontend** | React 19, TypeScript, Vite, Tailwind CSS, Lucide Icons, Shadcn UI primitives, Recharts |
| **Backend & API** | Node.js, Express 4, tRPC v11 (End-to-end type safety), Server-Sent Events (SSE) |
| **Database & ORM** | PostgreSQL, Drizzle ORM, Drizzle-Kit Migrations |
| **Validation & Security** | Zod schemas, bcryptjs password hashing, signed HTTP-only cookies, Rate Limiting |
| **Reporting & AI** | PDFKit (server-side PDF generation), Contextual Financial Intelligence Engine |
| **Testing** | Vitest, React Testing Library (68 passing tests across 11 test suites) |

---

## 📁 Repository Structure

```text
├── client/                     # Frontend client codebase
│   ├── src/
│   │   ├── components/         # Reusable UI & Intelligence widgets
│   │   │   ├── CopilotIntelligenceCard.tsx   # Health score gauge & Copilot prompt
│   │   │   ├── WhatIfSimulator.tsx           # Runway stress-testing sliders & charts
│   │   │   ├── NotificationBell.tsx          # Real-time notification center
│   │   │   └── GroupAuditTimeline.tsx        # Live SSE chronological audit log
│   │   ├── pages/              # Top-level route pages (Home.tsx, Auth, etc.)
│   │   ├── lib/                # Analytics formulas & formatting utilities
│   │   └── contexts/           # Authentication & Theme state providers
├── server/                     # Backend API & service architecture
│   ├── aiFinancialIntelligence.ts # Health score, anomalies, What-If simulation engine
│   ├── notificationService.ts  # Notification dispatch & SSE event publisher
│   ├── auditService.ts         # Chronological group activity stream & audit trail
│   ├── routers.ts              # tRPC routers (intelligence, shared, transactions, auth)
│   ├── intelligence.test.ts    # Vitest suite covering AI algorithms & routers
│   └── _core/                  # Express bootstrap, SSE handler, session cookies
├── drizzle/                    # PostgreSQL database schema definitions
├── scripts/                    # Production database bootstrap and seeding scripts
└── docs/                       # QA test plans, test cases, and release checklists
```

---

## 🧪 Testing & Verification

Ledgerly is fortified with an automated testing pipeline ensuring high reliability and zero regressions.

```bash
# Run the complete Vitest test suite
pnpm test

# Run strict TypeScript compiler verification
pnpm check

# Build client and server bundles for production
pnpm build
```

### Automated Test Matrix (68/68 Passing):
- **Intelligence & Forecasts (`server/intelligence.test.ts`):** 7 tests validating health scoring algorithms, What-If cash-flow curves, spending anomaly threshold detections, and notification states.
- **Security & Authorization (`server/security.test.ts`):** 24 tests verifying session cookies, rate-limiting, group authorization guards, and PDF generation.
- **Authentication & Password Recovery (`server/auth.*.test.ts`):** 9 tests verifying bcrypt hashing, single-use reset tokens, and logout lifecycles.
- **Analytics & Calculations (`client/src/lib/ledgerly-analytics.test.ts`):** 5 tests verifying MoM percentage deltas and transaction filters.
- **UI Components & Theme (`client/src/**/*.test.tsx`):** 10 tests verifying login modals, dark/light theme switching, and responsive views.

---

## ⚡ Quick Start & Local Development

### Prerequisites
- Node.js 20+
- pnpm (`npm install -g pnpm`)
- PostgreSQL instance running locally or hosted (e.g. Supabase, Neon)

### Installation
```bash
# 1. Clone repository
git clone https://github.com/SithumManusha/Ledgerly.git
cd Ledgerly

# 2. Install dependencies
pnpm install

# 3. Configure environment variables
cp .env.example .env
# Edit .env and supply your DATABASE_URL and JWT_SECRET

# 4. Push database schema
pnpm db:push

# 5. Start development server
pnpm dev
```
The application will be accessible at `http://localhost:3000`.

---

## 🚢 Production Deployment (Render)

Ledgerly is continuously deployed on Render:
- **Build Command:** `pnpm install --frozen-lockfile && pnpm build`
- **Start Command:** `pnpm start` (Runs database bootstrap and launches production Node service)
- **Environment Variables:**
  - `DATABASE_URL`: Hosted PostgreSQL connection URI with SSL
  - `JWT_SECRET`: High-entropy secret key for session verification
  - `APP_URL`: Production origin (`https://ledgerly-mbcd.onrender.com`)
  - `NODE_ENV`: `production`

---

## 📄 License
This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
