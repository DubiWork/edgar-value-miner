# Repository Agent Rules (`edgar-value-miner`)

> Always-on workspace instructions for AI coding agents operating in this repository. Keep PRs disciplined, traceable, versioned, and verified automatically without waiting for user reminders.

---

## 1. GitHub Identity & PR Policy

- **Default Account:** Run all Git commits, pushes, issue updates, and PR creation on `github.com` under **`ClaudeCodeAgentDubi`** (`ClaudeCodeAgentDubi <ClaudeCodeAgentDubi@users.noreply.github.com>`).
- **Never Switch Accounts:** Never run `gh auth switch --user DubiWork` or use `DubiWork` credentials unless the user explicitly instructs you to do so for that exact operation.
- **Branch Protection:** Never commit or push directly to `develop` or `main`. Every change uses a dedicated branch (`feat/...`, `fix/...`, `chore/...`) and a PR targeting `develop` (or `develop -> main` release PR on explicit approval).
- **No Self-Approval or Merge:** Never run `gh pr review --approve` or `gh pr merge` without explicit human user approval and instruction.

---

## 2. Issue & Epic Hierarchy (Mandatory)

1. **Every change starts with a GitHub Issue.** No code, config, or docs PR should be opened without a tracked issue.
2. **Every issue belongs to a parent Epic** (labeled `epic`). Link sub-issues clearly and select or create an appropriate Epic if none covers the work.
3. **Every PR body MUST declare both:**
   - `Part of #<epic-number>`
   - `Closes #<issue-number>` (or multiple `Closes #...` lines)

---

## 3. Automatic Release Hygiene Checklist (Execute on Every PR)

Complete these updates **proactively in every PR** without asking or waiting to be reminded:

1. **`CHANGELOG.md`:** Add concise entries under `## [Unreleased]` grouped by `Added` / `Changed` / `Fixed` / `Security`, referencing `(#<issue>)` or `(#<pr>)`.
2. **Semantic Versioning (`SemVer 2.0.0`):**
   - Bump `patch` (`X.Y.Z+1`) for bugfix-only PRs (`fix`).
   - Bump `minor` (`X.Y+1.0`) for new feature milestones or grouped feature increments (`feat`).
   - Bump `major` (`X+1.0.0`) only for breaking architectural releases.
   - Keep `package.json`, `package-lock.json` (both top-level and `packages[""]` header fields), `functions/package.json`, and `functions/package-lock.json` (both top-level and `packages[""]` header fields) in strict version sync. Edit lockfile headers surgically — **do not run `npm install` on Windows just to bump versions**, so platform-specific optional dependencies stay clean for Linux `npm ci`.
3. **`README.md`:** Update whenever user-facing capabilities, live URLs, architecture, tech stack, or setup scripts change.
4. **`ROADMAP.md`:** Update Epic/Phase statuses, shipped version rows, and active Epic/PR references when milestone state changes.
5. **Work-Time Tracking (`⏱️ Time Log`):**
   - Fill out the `## ⏱️ Time Log` table in `.github/pull_request_template.md` with session start timestamp, PR ready/update timestamp, active dev duration (minutes/hours), and calendar lead time.
   - Update the parent **Epic issue** checklist and `⏱️ Time & Cycle Log` table whenever a child PR is opened, updated, or merged.

---

## 4. Deployment & Production Tag Safety

- **No Manual Firebase Deploys:** Never run `firebase deploy` for Staging or Production locally.
  - Staging deploys automatically via `.github/workflows/deploy-staging.yml` on merge to `develop`.
  - Production deploys automatically via `.github/workflows/deploy-production.yml` on push to `main` **or** any `v*` tag push.
- **Never Push `v*` Tags from Feature Branches or `develop`:** Pushing any `v*` tag immediately triggers Production deployment.
- **Production Release Promotion (`develop -> main`):** Only when the user explicitly approves a release to `main`:
  1. Move `CHANGELOG.md` entries from `## [Unreleased]` into `## [X.Y.Z] - YYYY-MM-DD`.
  2. Verify SemVer parity across `package.json`, `functions/package.json`, `README.md`, and `ROADMAP.md`.
  3. After `main` merge is approved and green, cut tag `vX.Y.Z` and/or GitHub Release.

---

## 5. Verification Standard Before Pushing

Run and observe passing results after your final edit:
- **Frontend:** `npm run lint`, `npm test -- --run` (on Windows Vitest, pass `--pool=threads --maxWorkers=1 --no-file-parallelism` if worker startup times out, and do not run tests in parallel with `vite build`), and `npm run build`.
- **Cloud Functions (if `functions/` changed or for release sanity):** `cd functions && npm run build && npm test`.
- **Workspace Hygiene:** Stage files explicitly by path; never stage session logs, secrets (`.env*`), `.agents/`, `.firebase/`, `.github/reviews/`, or unrelated build outputs.
