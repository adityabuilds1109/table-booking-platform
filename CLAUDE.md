# CLAUDE.md

## Project
Restaurant table booking platform (portfolio project). Monorepo:
- `server/` — Node.js, TypeScript, Express, PostgreSQL, Prisma
- `client/` — React, TypeScript, Tailwind (Vite)

## About me
I know JavaScript, Node/Express, MySQL, Sequelize and PHP.
I'm learning TypeScript, React, PostgreSQL, Prisma, Jest and GitHub Actions.
- Explain non-obvious decisions in 1–3 sentences.
- When you introduce a new concept, say briefly what it is and why it's used.

## How to work
- Keep changes small: one concern per change. Don't touch unrelated files.
- For changes across multiple files, propose a plan first and wait for approval.
- Never run git commands that commit, push, merge or rewrite history. I do git myself.
- Don't add dependencies without asking and explaining why.
- When fixing a bug, find the root cause from the real error output first. No guess-patches, and no try/catch that hides errors.
- Never weaken, skip or delete tests to make them pass.
- If a requirement is unclear, ask instead of assuming.
- Pin devDependency versions compatible with Node 24 and the planned tooling (ts-jest needs TypeScript below 7). Check peer dependencies before installing the latest major.

## Code conventions
- TypeScript strict mode. No `any`; use `unknown` and narrow it.
- Validate all request input with Zod at the route boundary.
- Booking creation runs inside a DB transaction with row-level locking (`SELECT ... FOR UPDATE`) to prevent double bookings.
- One central error middleware. Error JSON shape: `{ "error": { "code": string, "message": string } }`.
- Secrets come only from environment variables. When adding a variable, update `.env.example`.
- Store all timestamps in UTC.

## Environment
- Windows, PowerShell. Give PowerShell-compatible commands.
- PostgreSQL runs via Docker Compose.

## Commands
<!-- Filled in as the project grows -->