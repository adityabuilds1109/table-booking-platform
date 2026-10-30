# Working with Claude Code — Notes

A log of every time Claude Code got something wrong, and how I caught it.

## Entry template

### YYYY-MM-DD — short title

- **Task:**
- **What Claude Code did:**
- **What was wrong:**
- **How I caught it:** (diff review / failing test / runtime error / docs)
- **Fix:**
- **Lesson → CLAUDE.md change?:**

## Entries

### 2026-10-19 — Plan used bash commands on a Windows machine

- **Task:** Plan the initial backend scaffold in server/.
- **What Claude Code did:** The Verification section used bash syntax (`PORT=5000 npm run dev`, `cd server && npm install`, `curl`).
- **What was wrong:** I'm on Windows PowerShell, where these fail or behave differently. CLAUDE.md already says to use PowerShell.
- **How I caught it:** Plan review before approving anything.
- **Fix:** Started a new conversation so CLAUDE.md was loaded. The second plan used `$env:PORT` and `Invoke-RestMethod`.
- **Lesson → CLAUDE.md change?:** No. CLAUDE.md is read when a session starts, so after editing it, start a new conversation.

### 2026-10-19 — Dev dependency versions didn't match my runtime or my test tooling

- **Task:** Install dependencies for the TypeScript + Express scaffold.
- **What Claude Code did:** Installed `@types/node` 26 and `typescript` 7.0.2, the newest versions on npm.
- **What was wrong:** I run Node 24, so `@types/node` 26 describes APIs my runtime doesn't have. ts-jest 29.4.15 declares `typescript: >=4.3 <7`, so TypeScript 7 would break the Jest setup later.
- **How I caught it:** Compared the versions in the summary with `node -v`. Then asked Claude Code to check ts-jest compatibility, and confirmed it myself with `npm view ts-jest peerDependencies` and `npm view typescript versions`.
- **Fix:** Pinned `typescript@~6.0.3` and `@types/node@24`.
- **Lesson → CLAUDE.md change?:** Yes. Added a rule to pin dev dependencies compatible with Node 24 and the planned Jest tooling.

### 2026-10-19 — package.json missing fields the plan implied

- **Task:** Create package.json for the server.
- **What Claude Code did:** Ran `npm init -y`, which leaves out `"private": true` and `engines`.
- **What was wrong:** Without `private`, the package can be published to npm by accident. Without `engines`, the required Node version isn't documented.
- **How I caught it:** Read the generated package.json against the plan.
- **Fix:** Added both by hand.
- **Lesson → CLAUDE.md change?:** No. Minor, but worth checking every generated package.json.

### 2026-10-20 — First `prisma migrate dev` failed with `spawn UNKNOWN`

- **Task:** Apply the initial Prisma migration on Windows.
- **What Claude Code did:** Ran `npx prisma migrate dev`, which failed with `spawn UNKNOWN`. Running the same command again worked.
- **What was wrong:** Unknown. Claude Code suggested Windows Defender interfering with the spawned process, but never proved it.
- **How I caught it:** Read the real error output instead of accepting the first explanation.
- **Fix:** Re-ran the command. If it returns, I'll investigate properly (antivirus exclusions, running the Prisma engines directly).
- **Lesson → CLAUDE.md change?:** No. The cause is unproven, so I'm not writing a rule for it.

### 2026-10-20 — psql command garbled by PowerShell quoting

- **Task:** Check seeded users and tables in the database.
- **What Claude Code did:** Passed SQL with escaped quotes (`\"User\"`) as a command-line argument to `docker compose exec ... psql -c`.
- **What was wrong:** Windows PowerShell 5.1 mangles `\"` in arguments, so psql received a broken query. The seed itself was fine.
- **How I caught it:** The query failed even though the data was correct. Claude Code diagnosed it as a quoting problem and proposed piping the SQL on stdin.
- **Fix:** Pipe SQL to `psql` through stdin with `exec -T`.
- **Lesson → CLAUDE.md change?:** Yes. Added the stdin rule under Environment.

### 2026-10-20 — Verified the database constraint myself instead of trusting "verified live"

- **Task:** Prisma schema with double-booking protection.
- **What Claude Code did:** Reported the exclusion constraint as "verified live."
- **What was wrong:** Nothing was wrong. But a claim isn't evidence until I've seen it.
- **How I caught it:** Read `migration.sql` and ran the overlap test in psql: overlapping CONFIRMED insert failed with `booking_no_overlap`, and overlap with a CANCELLED booking and back-to-back bookings succeeded.
- **Fix:** None needed.
- **Lesson → CLAUDE.md change?:** No. Habit: re-run the key test myself before merging.

### 2026-10-20 — Login timing leaked which seeded accounts exist

- **Task:** Build login with protection against email enumeration.
- **What Claude Code did:** Added a dummy bcrypt hash at cost 12 for unknown emails. The seed script still hashed passwords at cost 10.
- **What was wrong:** Seeded users verified in ~75 ms while unknown emails took ~280 ms, so response time revealed which emails exist.
- **How I caught it:** Claude Code measured timing during its own verification and reported it.
- **Fix:** Seed now uses the same `BCRYPT_COST` rules as the app, and the seeded users were deleted and re-seeded.
- **Lesson → CLAUDE.md change?:** Yes. Bcrypt cost comes from `BCRYPT_COST` everywhere.

### 2026-10-20 — Real error shape differed from the plan's guess

- **Task:** Map the Postgres exclusion-constraint error to 409 SLOT_TAKEN.
- **What Claude Code did:** The plan guessed Prisma code P2010. I made it provoke the real error first.
- **What was wrong:** Two different Prisma codes (P2039 and P2010) wrap the same Postgres 23P01 error, and P2002 has no `meta.target` in Prisma 7.
- **How I caught it:** Asked for the real error object before writing the mapper.
- **Fix:** Mapper reads `err.meta.driverAdapterError.cause` with type guards and checks the quoted constraint name.
- **Lesson → CLAUDE.md change?:** Yes. Added a note on the mapping.

### 2026-10-21 — Auth middleware needed a change outside the stated scope

- **Task:** Add authenticate and requireAdmin.
- **What Claude Code did:** Edited `errorHandler.ts`, which wasn't in the list I gave it, to map JsonWebTokenError to 401.
- **What was wrong:** Nothing, but without it expired and forged tokens would have returned 500. It flagged the change openly.
- **How I caught it:** Read the file list in its report and the diff.
- **Fix:** Accepted; follows the existing ZodError pattern.
- **Lesson → CLAUDE.md change?:** No.

### 2026-10-21 — Expiry test "failed" because the server was stale

- **Task:** Verify expired tokens return 401.
- **What happened:** With `JWT_EXPIRES_IN=2s` in `.env`, the token still worked after 3 seconds.
- **What was wrong:** `config.ts` reads env once at startup, and the running process predated my edit.
- **How I caught it:** Decoded the token's `exp - iat` (it said 3600, not 2) before blaming the code.
- **Fix:** Fully restarted the server; lifetime showed 2 and the token was rejected after 3 seconds.
- **Lesson → CLAUDE.md change?:** Yes. Restart after editing `.env`.

### 2026-10-21 — Wrong docker compose path in commands I was given

- **Task:** Run psql checks on the Mac.
- **What went wrong:** Commands used `-f ../docker-compose.yml`, which only works from `server/`. I also had a nested clone folder, which made paths confusing.
- **How I caught it:** The error named the path it tried to open.
- **Fix:** Use `docker compose ...` from the repo root; check `pwd` first.
- **Lesson → CLAUDE.md change?:** Yes. Added the path rule.

### 2026-10-29 — Audit report named the wrong package

- **Task:** Add Jest and supertest.
- **What Claude Code did:** Reported "1 high vulnerability in deepmerge" from the full audit.
- **What was wrong:** `npm audit --omit=dev` showed the real production issue: `body-parser` (DoS via compressed body). `deepmerge` only came in through Jest's dev tooling. Both were true for different scopes.
- **How I caught it:** Ran the production-only audit myself and a `--dry-run` of the fix.
- **Fix:** `npm audit fix` updated only `body-parser` to 2.4.0. I refused `--force`, which would have installed Jest 25.
- **Lesson → CLAUDE.md change?:** Yes. Never use `--force`; check `--omit=dev`.

### 2026-10-29 — TypeScript 6 stopped auto-including @types

- **Task:** Type-check the new Jest tests.
- **What Claude Code did:** First `tsc` run failed with `Cannot find name 'describe'`.
- **What was wrong:** TS 6 no longer loads `@types/*` automatically.
- **How I caught it:** Compiler error; it confirmed with `tsc --types node,jest`.
- **Fix:** Explicit `types` in tsconfig, plus `tsconfig.build.json` so tests and Jest types stay out of production.
- **Lesson → CLAUDE.md change?:** Yes.

### 2026-10-29 — Tests failed because the variable lived only in Claude Code's shell

- **Task:** Run the new suite on my own machine.
- **What happened:** `npm test` failed with "TEST_DATABASE_URL is not set".
- **What was wrong:** Claude Code had set it only in its own shell, so nothing in `.env` had it.
- **How I caught it:** Ran the tests myself rather than trusting the report.
- **Fix:** Added the variable to `server/.env`. The `_test` guard did its job.
- **Lesson → CLAUDE.md change?:** Yes (Commands section).

### 2026-10-29 — Schema returned two messages for one bad field

- **Task:** Booking rules and schemas with unit tests.
- **What Claude Code did:** Wrote checks for duration range and 15-minute step as separate refinements.
- **What was wrong:** `durationMinutes: 241` failed both, so clients got two joined messages for one field.
- **How I caught it:** Seven tests failed on the first run. It fixed the schema, not the tests.
- **Fix:** Dependent check moved behind `.pipe()`; tests assert one message per field.
- **Lesson → CLAUDE.md change?:** Yes.

### 2026-10-29 — Mutation checks showed the tests can fail

- **Task:** Trust the new tests.
- **What happened:** Swapping `z.iso.date()` for a regex failed exactly the 5 impossible-date tests; flipping `<` to `<=` failed exactly the boundary test; letting `authenticate` accept HS512 failed exactly 1 test.
- **Lesson:** A passing test only means something once I've seen it fail when the code is wrong. Not a mistake by Claude Code; evidence of my verification habit.

### 2026-10-29 — Concurrency block test passed without the lock

- **Task:** Prove `SELECT ... FOR UPDATE` serializes bookings.
- **What Claude Code did:** Wrote a block test where a separate transaction held `FOR UPDATE` on the table row.
- **What was wrong:** The test still passed after removing `FOR UPDATE` from `createBooking`. Inserting a booking takes a `FOR KEY SHARE` lock on the Table row through the foreign key, which conflicts with `FOR UPDATE`, so the insert waited anyway.
- **How I caught it:** The mutation check: remove the lock and see which tests fail.
- **Fix:** Test holder changed to `FOR NO KEY UPDATE`, which doesn't conflict with the foreign-key lock but does conflict with `FOR UPDATE`. After the fix, 3 of 4 tests fail without the lock.
- **Lesson → CLAUDE.md change?:** Yes. Add: "Every concurrency test needs a mutation check proving it fails when the lock is removed."

### 2026-10-29 — "Jest did not exit" warning was a leaked timer in a test

- **Task:** Concurrency tests for POST /bookings.
- **What Claude Code did:** Raced `createBooking` against `sleep(2000)` in the "different table" test, and said it had not seen the open-handle warning in unmutated runs.
- **What was wrong:** The losing timer kept Node alive about 2 seconds. Its claim was also wrong: it had sent earlier runs' output to /dev/null.
- **How I caught it:** Ran the file myself and saw the warning. Claude Code isolated it by running each test alone.
- **Fix:** `settlesWithin(promise, ms)` helper that clears its timer in `finally`. No `--forceExit`.
- **Lesson → CLAUDE.md change?:** Yes.

### 2026-10-29 — Pagination tie-breaker test passed without the tie-breaker

- **Task:** GET /bookings/me with pagination.
- **What Claude Code did:** Added `id` as a tie-breaker in the ordering and wrote a "no repeats, no gaps" test.
- **What was wrong:** With the tie-breaker removed the test still passed, because Postgres returned ties in insertion order on a small table.
- **How I caught it:** Mutation check (remove the tie-breaker, see what fails). Nothing did.
- **Fix:** Test now asserts ties are sorted by id; fails 10 of 10 runs without the tie-breaker.
- **Lesson → CLAUDE.md change?:** No (covered by the mutation-check rule).

### 2026-10-29 — A mutation "passed" because it didn't compile

- **Task:** Ownership mutation check for cancel.
- **What Claude Code did:** Replaced the ownership condition with `if (false)`; the suite failed, which looked like success.
- **What was wrong:** The failure was a compile error (TypeScript could no longer narrow `null`), not a failing test.
- **How I caught it:** It reported the compile error and redid the mutation in a form that compiles. 3 tests then failed on behavior.
- **Lesson:** Check that a mutation fails on assertions, not on compilation.

### 2026-10-29 — Origin schema accepted a wildcard hostname

- **Task:** CORS_ORIGINS config.
- **What was wrong:** The URL parser accepted `https://*.example.com`, which `cors` would never match (exact strings), so it looked configured but did nothing.
- **How I caught it:** A test Claude Code wrote.
- **Fix:** Schema rejects `*` anywhere. Tests not changed.
- **Lesson:** Validate config shape strictly, not just "parses as URL".

### 2026-10-30 — Mapper focused the wrong field

- **Task:** Register page.
- **What was wrong:** For a server error naming both name and email, the mapper focused Email while Name is first on the page.
- **How I caught it:** A stubbed VALIDATION_ERROR check in the browser suite.
- **Fix:** One-line field ordering fix in the mapper.
- **Lesson:** Test focus order, not just that an error appears.
