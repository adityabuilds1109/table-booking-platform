# Table Booking Platform

A restaurant table booking system with availability search, double-booking prevention via row-level locking, and an admin dashboard.

**Stack:** Node.js · TypeScript · Express · PostgreSQL · Prisma · React · Tailwind · Jest · Docker · GitHub Actions

![CI](https://github.com/adityabuilds1109/table-booking-platform/actions/workflows/ci.yml/badge.svg)

🚧 Work in progress

**Where it is now:** the API is complete for registering, logging in, searching availability, booking, listing and cancelling bookings. The React app has routing, a layout, and working login and registration pages (with form validation that mirrors the server's rules), and the home page where you search for free tables and book one; the "my bookings" page lists your bookings (paged, newest first) and lets you cancel upcoming ones after a confirm step. The admin endpoints are not built yet.

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

## Deploying (free tiers)

The API runs on **Render** (free web service), the database on **Neon** (free Postgres), and the client on **Netlify** (static site). Render's own free Postgres is not used: it is deleted 30 days after creation. Free-tier terms change, so re-read each vendor's free-plan page when you sign up. Nothing in the repo needs a secret; every secret is set in a dashboard.

**Deploys are automatic for now:** Render and Netlify each deploy when `main` changes, without waiting for CI. Making CI gate the deploys (deploy hooks triggered by a green workflow) is a planned later step.

### 1. Database (Neon)

1. Create a project (pick the region closest to your Render region).
2. In the **SQL editor**, enable the extension the booking constraint needs, once:

   ```sql
   CREATE EXTENSION IF NOT EXISTS btree_gist;
   SELECT extname FROM pg_extension WHERE extname = 'btree_gist';
   ```

   The first migration also runs `CREATE EXTENSION IF NOT EXISTS btree_gist`, which does nothing if it is already there. Without this extension the "no two bookings overlap" constraint cannot be created, so if Neon refuses it, stop: do not edit the migration.
3. Copy the **direct** connection string (not the pooled one: migrations take a database lock that does not work reliably through a pooler). Use it **exactly as Neon gives it** (it ends in `sslmode=require&channel_binding=require`): no edits are needed, and it was checked to work with this app's database driver. If the server log shows a `pg` "SECURITY WARNING" saying `sslmode=require` is treated as an alias for `verify-full`, it is harmless: the connection is already encrypted and the certificate is verified (the warning is about how a future driver version will interpret the word `require`).

### 2. API (Render web service)

| Setting | Value |
|---|---|
| Root Directory | `server` |
| Build Command | `npm ci --include=dev && npm run build && npx prisma migrate deploy` |
| Start Command | `npm start` |
| Health Check Path | `/health` |
| Instance type | Free |

- `--include=dev` is needed because Render sets `NODE_ENV=production`, which makes a plain `npm ci` skip the TypeScript compiler, the Prisma CLI and the type declarations the build uses (the build fails without it).
- The build applies pending migrations (`migrate deploy` only applies committed migrations; it never resets anything). If a migration fails, the build fails and Render keeps serving the previous version. If your Render dashboard offers a **Pre-Deploy Command** on the free instance type, you can move `npx prisma migrate deploy` there.
- Environment variables (all in the Render dashboard; the app reads them once at startup, so **redeploy or restart after changing any**):

| Variable | Value |
|---|---|
| `NODE_ENV` | `production` |
| `NODE_VERSION` | `24` |
| `DATABASE_URL` | the Neon direct connection string (secret) |
| `JWT_SECRET` | 48 random bytes, e.g. `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` (secret; changing it logs everyone out) |
| `CORS_ORIGINS` | your Netlify address, exactly `https://<site>.netlify.app` (no trailing slash, no path, no `*`) |
| `BCRYPT_COST` | `10` to start (the minimum allowed in production); raise it only if logging in stays fast, since free instances have very little CPU |

  **`CORS_ORIGINS` is effectively required in production.** If it is missing, the server starts with the local-development default (`http://localhost:5173`) and every browser request from your real site is blocked, while `/health` still works. If it is malformed (trailing slash, wildcard) the server refuses to start and the Render logs say why. Do not set `PORT` (Render provides it) and do not set `SEED_*` or `TEST_DATABASE_URL`.

### 3. Client (Netlify)

| Setting | Value |
|---|---|
| Base directory | `client` |
| Build command | `npm run build` |
| Publish directory | `client/dist` (shown as `dist` when the base directory is `client`) |
| `NODE_VERSION` | `24` |
| `VITE_API_URL` | `https://<your-api>.onrender.com` (no trailing slash) |

`VITE_API_URL` is read **while building** and written into the JavaScript, so it is public and changing it needs a new deploy, not a restart. [client/public/_redirects](client/public/_redirects) makes Netlify serve the app for every path (`/bookings?page=2`, `/login`, a browser refresh), so deep links do not return 404. Netlify deploy previews have different addresses that `CORS_ORIGINS` does not list, so logging in will not work on them.

**Order for the first deploy:** Neon, then Render (with a placeholder `CORS_ORIGINS`), then Netlify; once Netlify shows its real address, put it in `CORS_ORIGINS` on Render and redeploy the API.

### 4. First admin and the restaurant's tables

The development seed (`npm run db:seed`) creates the well-known `admin@example.com` and `user@example.com`, so **never run it against a production database**. Instead:

1. Register your real account on the deployed site.
2. In the Neon SQL editor make it an admin (the API reads the role from the database on every request, so this takes effect at once):

   ```sql
   UPDATE "User" SET role = 'ADMIN' WHERE email = 'you@example.com';
   ```

3. Add the tables (the search shows nothing until some exist):

   ```sql
   INSERT INTO "Table" (id, name, capacity, "isActive") VALUES
     (gen_random_uuid()::text, 'T1', 2, true),
     (gen_random_uuid()::text, 'T2', 2, true),
     (gen_random_uuid()::text, 'T3', 4, true),
     (gen_random_uuid()::text, 'T4', 4, true),
     (gen_random_uuid()::text, 'T5', 6, true);
   ```

### 5. Free-tier behaviour to expect

- **Cold starts:** Render's free service sleeps after 15 minutes without traffic, and the next request waits roughly 30 to 60 seconds while it starts (Neon adds about a second to wake up after 5 idle minutes). The first screen after a quiet period can therefore sit on "Searching…" or "Checking your session…" for up to a minute. Open the site a minute before showing it to anyone.
- The free web service's disk is wiped on every restart (the app stores nothing on disk) and it may restart at any time.
- Neon's free plan has a monthly compute allowance and a small storage limit; Render's free plan has a monthly allowance of instance hours and build minutes. Light use stays within them.
- Before any change to the database schema, make a Neon branch (an instant snapshot) first: migrations run automatically on every deploy and a destructive one cannot be undone by redeploying. There is no staging environment.
- There is still no rate limiting (see below), so a public login endpoint can be guessed at; use strong passwords for any real account.

### 6. Checking a live deployment

Never point the browser test scripts used during development at a live database: they empty every table. Check by hand instead:

- `curl -i https://<api>/health` (the first call after a quiet period is slow).
- Allowed origin gets its own address echoed back, any other origin gets no `Access-Control-Allow-Origin` header:

  ```
  curl -i -X OPTIONS https://<api>/bookings -H "Origin: https://<site>.netlify.app" -H "Access-Control-Request-Method: POST"
  curl -i -X OPTIONS https://<api>/bookings -H "Origin: https://evil.example" -H "Access-Control-Request-Method: POST"
  ```

  (On Windows PowerShell use `curl.exe`.)
- In a browser on the Netlify address: open `/bookings?page=2` and `/login` directly and refresh, register, search, book, cancel.
- In the Neon SQL editor: `SELECT conname FROM pg_constraint WHERE conname = 'booking_no_overlap';` returns one row.

## Known limitations

- **Times use the device's time zone, not the restaurant's.** The API works entirely in UTC and has no idea where the restaurant is. The search and booking pages turn the date and time a person picks into UTC using the time zone of *their device*, and show times back in that same zone (always with its name, for example "19:00 CET"). Someone searching from a different time zone than the restaurant's, such as a traveller or a laptop set to the wrong zone, will therefore book the wrong local time. The proper fix is a restaurant time-zone setting on the server, with times entered and shown in that zone.
- **No rate limiting.** `POST /auth/login` and `POST /auth/register` accept unlimited attempts, so online password guessing and credential stuffing are not slowed down. Passwords are bcrypt-hashed and login failures are deliberately generic, but a limiter (per IP and per account) or a reverse proxy in front of the API is needed before this is used for real.
- **Registering reveals whether an email already has an account.** An existing address gets `409 EMAIL_TAKEN`, and the form says so, so people get a clear message. Login does not leak this (an unknown email and a wrong password give the same error). Closing the gap on registration would need an email-confirmation flow.
