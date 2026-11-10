# AI workflow note

This note records the observed workflow used to produce this package. It does not claim that a human performed reviews or recordings that have not occurred.

## Tools used

OpenAI Codex assisted with scoping, source implementation, documentation, command execution, and test analysis. Sites tooling provided the initial scaffold; after Render was requested, Codex adapted the implementation into a standalone React/Vite and Express app. Tool-assisted web research checked Render's free hosting constraints. Computer Use initially failed, then successfully exercised core Chrome flows. It exposed an import display bug that was corrected. The screen recorder later failed with a foreground-process error; no video was produced.

## Where AI accelerated the work

- Turned the exercise into a bounded implementation plan: a document library, editor, seeded-account sharing, and imports.
- Produced the first pass of UI components, API handlers, persistence adapters, validation, and tests.
- Helped diagnose installation constraints and use locally cached packages for an offline build.
- Drafted architecture, reviewer instructions, and an explicit delivery checklist.

## Generated output that was changed or rejected

- The initial hosting-specific scaffold was replaced after the user selected Render. The submitted app uses an ordinary Node process and a PostgreSQL deployment path.
- The first seed implementation passed an unbound statement to the database batch helper. The failing automated test exposed this; the statement was bound and the seed behavior was corrected.
- Repeated seeding was changed to avoid restoring a revoked seed grant or overwriting the intended persisted state.
- Save waiting logic was adjusted to stop on a failed in-flight request, and editor history was reset when switching documents to prevent undo from crossing document boundaries.
- Browser testing exposed escaped apostrophes in Markdown imports. Inline-token decoding was corrected and covered by a seventh regression test.
- No invented deployment URL, screenshot, or walkthrough was accepted as evidence. The user supplied the actual Render URL; Chrome confirmed library loading and database health. Screenshots and walkthrough remain pending.

## How correctness was checked

Seven automated tests ran successfully. They cover authorization and conflicts, formatting/sharing persistence across database reopen, idempotent seeds, input validation, Markdown conversion, and HTTP session/upload/error behavior. A production frontend build succeeded and the local server startup was observed. The source package is accompanied by a file inventory with SHA-256 hashes so its contents can be checked after extraction.

## Verification still required

Core Chrome interaction checks were subsequently completed; see BROWSER_VERIFICATION.md. Complete visual, mobile, and accessibility checks remain pending. Render is deployed; Chrome confirmed library loading and a database-backed health response. Full PostgreSQL contract testing, a reproducible clean Linux install, live workflow checks, and the recorded walkthrough remain pending. The automated tests support backend behavior on SQLite. The targeted Chrome checks provide additional interaction evidence, but neither establishes complete frontend coverage or complete hosted workflow coverage. Completing those checks is the next priority.
