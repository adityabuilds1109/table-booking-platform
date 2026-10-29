# Table Booking Platform

A restaurant table booking system with availability search, double-booking prevention via row-level locking, and an admin dashboard.

**Stack:** Node.js · TypeScript · Express · PostgreSQL · Prisma · React · Tailwind · Jest · Docker · GitHub Actions

![CI](https://github.com/adityabuilds1109/table-booking-platform/actions/workflows/ci.yml/badge.svg)

🚧 Work in progress

**Where it is now:** the API is complete for registering, logging in, searching availability, booking, listing and cancelling bookings. The React app has routing, a layout and login handling; the login, register, search and bookings *pages* are still placeholders. The admin endpoints are not built yet.

## Running it locally

**You need:** Node 24, Docker. Run the commands below from the repository root unless a `cd` says otherwise.

### 1. Database

```
docker compose up -d db
```

### 2. Server (http://localhost:4000)

```
cd server
npm ci
```

Create your `.env` from the template (`cp .env.example .env` on macOS/Linux, `Copy-Item .env.example .env` in PowerShell), then edit it:

- `JWT_SECRET`: at least 32 characters and not the `change-me…` placeholder (the server refuses to start otherwise). Generate one with
  `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`
- `SEED_ADMIN_PASSWORD` and `SEED_USER_PASSWORD`: any passwords. They are used for `admin@example.com` and `user@example.com`.

```
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

Check it is up: <http://localhost:4000/health> should show `{"status":"ok"}`. The server reads `.env` only at startup, so **restart it after editing `.env`** (`npm run dev` does not reload it).

### 3. Client (http://localhost:5173)

In a second terminal:

```
cd client
npm ci
```

Create `client/.env` from `client/.env.example` the same way. It holds one setting, `VITE_API_URL` (default `http://localhost:4000`), and everything starting with `VITE_` ends up in the browser bundle, so never put a secret there. Then:

```
npm run dev
```

Restart it after editing `client/.env`. The port is fixed on purpose: if 5173 is taken, Vite stops instead of picking another one.

### Browser access to the API (CORS)

A browser only lets the client read the API's responses if the API allows its origin. The server's `CORS_ORIGINS` setting (comma-separated, exact origins, default `http://localhost:5173`) is that allow-list; it rejects wildcards and does not use cookies. When the client is deployed, set `CORS_ORIGINS` to its address.

## Tests and checks

The server tests need their own database, because they **empty every table**. They refuse to run unless its name ends in `_test`.

```
docker compose exec -T db psql -U booking -d booking -c "CREATE DATABASE booking_test"
cd server
npm run test:db:migrate
npm test
```

The first command is needed once. `TEST_DATABASE_URL` comes from `server/.env` (it is already in `.env.example`).

Both packages have the same two type and build checks, which CI also runs (one job each, on every pull request and on pushes to `main`):

```
npm run typecheck
npm run build
```

The client has no automated tests yet.
