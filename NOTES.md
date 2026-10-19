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