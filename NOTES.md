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