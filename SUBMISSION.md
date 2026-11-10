# Folio submission inventory

**Status: source/review package prepared; final submission incomplete.**

## Included

| Material | Location |
| --- | --- |
| Full active application source | `src/`, `lib/`, `server/`, `public/`, `index.html` |
| Dependency declarations and lockfile | `package.json`, `package-lock.json` |
| Build configuration | `vite.config.js` |
| Source exclusions | `.gitignore` |
| Render deployment configuration | `render.yaml` |
| Seven automated tests | `tests/documents.test.mjs` |
| Setup, demo accounts, supported file types, review steps | `README.md` |
| Browser check results and remaining gaps | `BROWSER_VERIFICATION.md` |
| Architecture and prioritization note | `ARCHITECTURE.md` |
| AI usage and verification note | `AI_WORKFLOW.md` |
| 3–5 minute recording outline | `WALKTHROUGH_PLAN.md` |
| Deployment URL status file | `LIVE_URL.txt` — pending, no live URL |
| Walkthrough URL status file | `WALKTHROUGH_URL.txt` — pending, no recording |
| Sample upload files | `samples/team-brief.md`, `samples/meeting-notes.txt` |
| Exact packaged file list and SHA-256 digests | `FILE_MANIFEST.json` (generated in the share folder) |

The updated ZIP contains one top-level `Folio-Submission-Updated` folder. `FILE_MANIFEST.json` lists every other packaged file, its byte size, and SHA-256 digest; it excludes itself. Dependencies, local databases, build output, caches, secrets, and the superseded scaffold are not included.

## Verification performed

- Seven local automated tests passed.
- The production frontend build passed.
- Local server startup succeeded.
- Core Chrome flows were exercised; the browser check report distinguishes passes from remaining checks.
- Package file contents and ZIP hashes were checked during packaging.

## Required before final submission

- [ ] Verify a clean Linux dependency installation and PostgreSQL behavior.
- [ ] Deploy to Render, verify the live user flow, and replace `LIVE_URL.txt` with the real URL.
- [ ] Complete the remaining visual/mobile, accessibility, and recovery checks listed in `BROWSER_VERIFICATION.md`. No screenshots or demo GIF are currently included.
- [ ] Record a 3–5 minute walkthrough, host it, and replace `WALKTHROUGH_URL.txt` with the real URL.
- [ ] Upload the completed materials to the intended Google Drive account and obtain a reviewer-accessible folder link.
- [ ] Update this checklist and rebuild the ZIP after adding the missing deliverables.

## Reviewer credentials

Use the in-app switcher to select Maya Chen (`maya@folio.demo`), Alex Morgan (`alex@folio.demo`), or Sam Rivera (`sam@folio.demo`). No passwords. These accounts intentionally share a demo environment; they are not real authentication identities.

## What works and what is scoped out

Implemented: create/rename/edit/reopen documents; rich-text controls; debounced saves; text/Markdown import; owner/editor/viewer grants; accessible-document filtering; SQLite persistence; version-based conflict rejection; formatted HTML export. Backend behavior is tested locally and core desktop Chrome flows were checked; full browser coverage and hosting verification remain pending.

Intentionally omitted: real-time merge/presence, comments, full Word compatibility, real identity, and version-history browsing. Hosting/upload/video are pending delivery work, not intentional feature cuts. See `ARCHITECTURE.md` for the next 2–4 hours of work.
