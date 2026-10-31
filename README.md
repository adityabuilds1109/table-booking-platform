# Table Booking Platform

A restaurant table booking system with availability search, double-booking prevention via row-level locking, and an admin dashboard.

**Stack:** Node.js · TypeScript · Express · PostgreSQL · Prisma · React · Tailwind · Jest · Docker · GitHub Actions

![CI](https://github.com/adityabuilds1109/table-booking-platform/actions/workflows/ci.yml/badge.svg)

🚧 Work in progress

**Where it is now:** the API is complete for registering, logging in, searching availability, booking, listing and cancelling bookings. The React app has routing, a layout, and working login and registration pages (with form validation that mirrors the server's rules), and the home page where you search for free tables and book one; the "my bookings" page lists your bookings (paged, newest first) but has no cancel button yet. The admin endpoints are not built yet.

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

### Checking that the client's form rules match the server's

The sign-in and registration forms validate in the browser with the same rules as the API (`client/src/auth/credentialSchemas.ts` and `server/src/auth/schemas.ts`). The two files are separate, so after changing validation on either side, run:

```
cd client
npm run check:schema-parity
```

It feeds about 51,000 inputs through both (length and byte-length boundaries, Unicode, whitespace, wrong types, plus seeded random ones) and compares whether each is accepted or rejected, which fields fail, and the cleaned-up values that would be sent. It exits with an error if they disagree. This is a manual check, not part of CI. It adds no dependency: it runs through the `tsx` that `server/` already has installed, so run `npm ci` in `server/` as well as `client/` first.

### Checking the local-time to UTC conversion

The booking pages convert a local date and time to the UTC the API expects (and back). Time zones and clock changes make that easy to get subtly wrong, so this check proves it rather than trusting a few examples. After changing anything in `client/src/booking/` or the server's booking rules, run:

```
cd client
npm run check:time-conversion
```

For about 15 time zones (half-hour and 45-minute offsets such as Kolkata and Kathmandu, daylight saving in both hemispheres, the +14 zone, Samoa's skipped day) it converts **every 15-minute slot of a whole year** and compares each result with an independent calculation made with `Intl`. It also checks that every converted slot is accepted by the server's own validation, that times skipped or repeated by clock changes are detected, and that the client's booking limits, option lists and page-number limits equal the server's. It also covers the "My bookings" rules (reading `?page=`, which bookings can be cancelled, and the messages for each cancel failure). It exits with an error on any difference. Like the parity check it is manual, is not part of CI, adds no dependency, and needs `npm ci` to have been run in `server/` too. It takes a few seconds.

## Known limitations

- **Times use the device's time zone, not the restaurant's.** The API works entirely in UTC and has no idea where the restaurant is. The search and booking pages turn the date and time a person picks into UTC using the time zone of *their device*, and show times back in that same zone (always with its name, for example "19:00 CET"). Someone searching from a different time zone than the restaurant's, such as a traveller or a laptop set to the wrong zone, will therefore book the wrong local time. The proper fix is a restaurant time-zone setting on the server, with times entered and shown in that zone.
- **No rate limiting.** `POST /auth/login` and `POST /auth/register` accept unlimited attempts, so online password guessing and credential stuffing are not slowed down. Passwords are bcrypt-hashed and login failures are deliberately generic, but a limiter (per IP and per account) or a reverse proxy in front of the API is needed before this is used for real.
- **Registering reveals whether an email already has an account.** An existing address gets `409 EMAIL_TAKEN`, and the form says so, so people get a clear message. Login does not leak this (an unknown email and a wrong password give the same error). Closing the gap on registration would need an email-confirmation flow.
