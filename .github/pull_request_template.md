## Summary

<!-- Concise summary of what this PR changes and why. -->

## Parent Epic & Linked Issues

Part of #<epic-number>

Closes #<issue-number>

## ⏱️ Time Log

| Milestone | Timestamp / Duration | Notes |
| :--- | :--- | :--- |
| Session Start | `YYYY-MM-DD HH:MM +02:00` | Issue grooming / start of implementation |
| PR Opened / Updated | `YYYY-MM-DD HH:MM +02:00` | Branch pushed & PR ready for review |
| Active Dev Time | `~Xh Ym` | Hands-on implementation & debugging time |
| Calendar Lead Time | `~Xh` | Issue start / first commit → PR ready (or merged) |

## Release Hygiene Checklist

- [ ] `CHANGELOG.md` updated under `## [Unreleased]` with `(#issue)` references
- [ ] SemVer bumped/synced across `package.json`, `package-lock.json`, `functions/package.json`, and `functions/package-lock.json` *(or N/A if pre-release docs-only on current version)*
- [ ] `README.md` updated for user-facing changes *(or N/A)*
- [ ] `ROADMAP.md` & parent Epic checklist / `⏱️ Time & Cycle Log` updated
- [ ] Local lint, unit tests, and production builds verified; no `v*` tags pushed from feature branches

## Verification

- [ ] `npm run lint`
- [ ] Unit tests (`npm test -- --run`)
- [ ] `npm run build`
- [ ] Cloud Functions build & tests (`cd functions && npm run build && npm test`) *(if applicable)*
- [ ] Playwright E2E *(if UI/routing changed)*
