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
- Never run `npm audit fix --force`. It can downgrade packages by several majors (it tried to install Jest 25). Use `npm audit --omit=dev` to see what reaches production; dev-tooling advisories are documented, not force-fixed.
- Run `npm test` after every change that touches server code. Tests need `TEST_DATABASE_URL` pointing at a database whose name ends in `_test`.

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
- TypeScript 6 doesn't auto-include `@types/*`. `tsconfig.json` lists `types` explicitly (`node`, `jest`); `tsconfig.build.json` excludes tests and Jest types from production builds.
- Test setup (`src/test/`) must refuse to run unless the database name ends in `_test`, and must never print the connection URL.
- Booking time rules live in `src/bookings/rules.ts`. Time-dependent checks take `now` as a parameter so tests control the clock. Static shape rules live in Zod schemas.
- When one Zod field has dependent checks (range, then step), chain them with `.pipe()` so the client gets one error message per field, not stacked ones.
- Query and params validation uses `validateQuery` / `validateParams` (Express 5 `req.query` is read-only). Never assign to `req.query`.
- Booking creation must lock the Table row with `SELECT ... FOR UPDATE`. A concurrency test must prove losers are rejected by the app check, not by the exclusion constraint.
- Never use `--forceExit` to silence Jest's open-handle warning; find the root cause. Timers raced in tests must be cleared. Every concurrency test needs a mutation check proving it fails when the lock is removed.

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

- `npm run dev`: start the dev server (restart manually after editing `.env`)
- `npm test`: Jest, runs in band against `booking_test`
- `npm run test:db:migrate`: apply migrations to the test database
- `npm run typecheck`: `tsc --noEmit`
- `npm run build`: `prisma generate` + compile with `tsconfig.build.json`
- `npm run db:generate` / `db:seed`: Prisma client / seed data
- Client (in `client/`): `npm run dev` (port 5173, strictPort), `npm run typecheck`, `npm run build`. Needs `client/.env` with `VITE_API_URL`.
- Run server and client in separate terminals; never start a second dev server on the same port.
