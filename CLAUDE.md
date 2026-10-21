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
- Prisma is pinned to 7.10.1 (8.0 is still a release candidate). Don't upgrade without asking.
- Database constraints Prisma can't model (exclusion constraint, CHECKs) live as hand-written SQL in migration files. Never regenerate or reset migrations without asking.
- Auth: `authenticate` verifies the JWT (HS256 only) and loads the user from the DB on every request, so role changes and deleted users take effect immediately. Never trust the role inside the token.
- Every authentication failure returns the same 401 `UNAUTHORIZED` message. Login returns the same 401 `INVALID_CREDENTIALS` for unknown email and wrong password, and always runs a bcrypt compare (dummy hash at the same cost).
- Bcrypt cost comes from `BCRYPT_COST` everywhere, including the seed.
- Error mapping for database errors reads `err.meta.driverAdapterError.cause` (Prisma 7 + adapter-pg). Don't match on Prisma's `err.code` for 23P01.

## Environment

- Development happens on two machines: Windows (PowerShell) and macOS (zsh). Give commands for the OS I mention; if unsure, ask.
- Docker Compose paths depend on the current folder: from the repo root use `docker compose ...`; from `server/` use `docker compose -f ../docker-compose.yml ...`. Check `pwd` first.
- `config.ts` reads env vars once at startup. After editing `server/.env`, fully restart the dev server (`tsx watch` doesn't reload `.env`).
- npm versions differ between my machines and may rewrite `package-lock.json` (`"peer": true` noise). Use `npm ci` to install; don't commit lockfile changes unless a dependency actually changed.
- PostgreSQL runs via Docker Compose.
- Windows PowerShell 5.1 mangles `\"` inside command arguments. For SQL with quoted identifiers, pipe it to psql on stdin: `@'...'@ | docker compose -f ..\docker-compose.yml exec -T db psql -U booking -d booking`.
- `prisma migrate dev` doesn't generate the client in Prisma 7. Run `npm run db:generate` after every schema change.
- The generated Prisma client (`server/src/generated/`) is gitignored. Fresh checkouts and CI need `prisma generate` before `tsc`.

## Commands

<!-- Filled in as the project grows -->
