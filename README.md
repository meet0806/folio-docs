# Folio

A lightweight team document editor built for the Ajaia exercise. Create a document, write with rich-text formatting, import a text file, and share it with another demo account.

**Submission status:** the local implementation, seven automated tests, and production build are complete. Core Chrome flows have been exercised; broader visual/mobile checks, Render deployment, Google Drive upload, and the walkthrough recording are pending. See [SUBMISSION.md](SUBMISSION.md) for the exact status; no live URL or video is claimed in this package.

## Run locally

Requirements: Node.js 24 or newer, npm, and internet access for the initial dependency installation. No paid service, API key, or database account is needed locally.

Extract the ZIP, open a terminal in the folder containing `package.json`, then run:

```sh
npm ci
npm run build
npm start
```

Open **http://localhost:3000**. The first startup creates `data/folio.db` and seeds two example documents. Documents and access grants remain in that SQLite file after refresh and server restart. Keep the `data` directory to retain your work.

For development with live updates:

```sh
npm run dev
```

Stop the other server first; both commands default to port 3000. In Windows PowerShell, use `npm.cmd` in place of `npm` if script execution policy prevents running `npm.ps1`.

## Review the main flow

1. Start as Maya Chen. Open the welcome document or choose **New document**.
2. Change the title, type content, and try bold, italic, underline, headings, and numbered or bulleted lists. Changes autosave after a short pause; wait for **All changes saved**.
3. Return to the document library and reopen the document. Refresh to check persistence.
4. Choose **Import a file** and select `samples/team-brief.md` or `samples/meeting-notes.txt`.
5. As the owner, choose **Share** and give Alex **Can edit** access.
6. Use the account switcher at the bottom of the sidebar to select Alex. Open **Shared with me**, edit the shared document, and let it save.
7. Switch back to Maya. Change Alex to **Can view**, then switch to Alex and reopen the document to check read-only access. Choose **No access** as Maya to revoke sharing.
8. Use **Export** to download a formatted HTML copy.

| Demo account | Display email | Initial documents |
| --- | --- | --- |
| Maya Chen | maya@folio.demo | Owns the welcome document; can edit Alex's checklist |
| Alex Morgan | alex@folio.demo | Owns the launch checklist |
| Sam Rivera | sam@folio.demo | Starts with an empty library |

No password is required. These are deliberately switchable identities, not production authentication. Everyone using a deployment shares this demo workspace. Use sample content only. Account choice is stored in a cookie, so use separate browser profiles/private windows if testing different users simultaneously. Reopen documents after changing access to refresh the UI; the server checks access on every document request.

## File support and editing limits

- Import UTF-8 `.txt` and `.md` files, up to 100,000 bytes (100 KB). The imported content becomes a new document; the original file is not retained as an attachment.
- Common Markdown headings, emphasis, lists, block quotes, and code blocks are converted to structured editor content. This is a limited Markdown importer: tables, images, task checkboxes, and active links are not preserved as their original interactive structures. Raw HTML is treated as text.
- `.docx`, PDFs, and binary attachments are not supported.
- Titles must contain 1–120 characters. Structured content is capped at 500,000 serialized characters, with separate request, nesting, and node-count limits.
- Formatting is stored as validated editor JSON. Export produces HTML, not a PDF or a Markdown round trip.
- Concurrent edits use version checks rather than live merging. A stale save is rejected; export your unsaved draft, reload the saved version, and reconcile manually. Unsaved changes are kept in the current page, not an offline recovery store.

## Tests and verification

```sh
npm test
npm run build
```

The seven tests cover permission enforcement and revocation, stale-write conflicts, formatting and access persistence after database reopen, seed idempotency, content/import validation, and HTTP behavior including upload limits and cross-origin protection. They use temporary SQLite databases and an ephemeral HTTP port; they do not modify the development database.

The last local run passed all seven tests and the production build. A server startup was also observed. Core Chrome interactions were subsequently checked: creation, renaming, formatting, autosave, refresh, shared editing, viewer controls, and Markdown import. See [BROWSER_VERIFICATION.md](BROWSER_VERIFICATION.md) for exact evidence and remaining checks. PostgreSQL execution and a clean Linux/Render installation have not been verified. These are outstanding checks, not inferred passes.

An additional PostgreSQL permission/conflict contract runs when `TEST_DATABASE_URL` is set. Use a **dedicated disposable test database**, because this test creates schema and leaves test records. On PowerShell:

```powershell
$env:TEST_DATABASE_URL = '<test PostgreSQL connection string>'
npm.cmd test
```

## Deploy to Render

`render.yaml` defines a Node web service and PostgreSQL database. The app refuses to start on Render without `DATABASE_URL`, preventing accidental use of Render's temporary filesystem for document storage.

1. Put this project in a Git repository with `package.json` and `render.yaml` at the repository root.
2. In Render, create a **Blueprint** from that repository and review the web service/database configuration.
3. The initial deployment build command is `npm install --package-lock=false --include=dev --include=optional && npm run build`; the start command is `npm start`. This temporary build command resolves Linux optional packages missing from the offline Windows lockfile. It bypasses that lockfile, so regenerate and verify a complete lockfile after the first successful deployment, then return to `npm ci --include=dev && npm run build`. The Blueprint supplies the database connection string and uses `/api/health` for the health check.
4. Check deployment logs, database connectivity, and the complete sharing flow. The lockfile was produced offline on Windows; verify Linux optional build dependencies during this first deployment and regenerate the lockfile in a network-enabled clean checkout if required.
5. Put the actual successful deployment URL in `LIVE_URL.txt` and update `SUBMISSION.md` before submission.

The configured plans are free. Render's documentation checked during implementation states that free web services sleep when idle and free PostgreSQL expires after 30 days. Confirm the current terms in [Render's free service documentation](https://render.com/docs/free), and keep the review period within the database lifetime or arrange a durable alternative. No paid upgrade has been requested or provisioned.

## Configuration

| Variable | Behavior |
| --- | --- |
| `PORT` | HTTP port; defaults to `3000` |
| `SQLITE_PATH` | Local database path; defaults to `./data/folio.db` |
| `DATABASE_URL` | Uses PostgreSQL instead of SQLite when present; required on Render |
| `TEST_DATABASE_URL` | Enables the optional PostgreSQL test contract |

Set environment variables in your shell or Render dashboard. The application does not automatically load `.env` files. Never include connection strings in the submission.

## Project map

```text
src/                 React interface and CSS
lib/documents.mjs    Validation, imports, access rules, seeds, document operations
server/app.mjs       Express API and request handling
server/database.mjs  SQLite and PostgreSQL adapters and initial schema
server/index.mjs     Startup, persistence selection, frontend serving
tests/               Automated service and HTTP tests
public/              Application icon
samples/             Files for demonstrating import
render.yaml          Render Blueprint
```

Read [ARCHITECTURE.md](ARCHITECTURE.md), [AI_WORKFLOW.md](AI_WORKFLOW.md), and [WALKTHROUGH_PLAN.md](WALKTHROUGH_PLAN.md) for decisions, verification limits, and a suggested 3–5 minute recording sequence.

## Scope and next steps

Core flows are implemented with two small enhancements: viewer/editor roles and formatted HTML export. Live multi-user cursors, automatic merge, comments, version-history browsing, real sign-in, document deletion, and advanced Word compatibility are intentionally out of scope.

With another 2–4 hours: complete desktop/mobile browser checks and PostgreSQL/Render verification; record the walkthrough; improve save/account-switch edge cases and failure recovery; add a small browser regression test for editing, import, and sharing. A production release would additionally need real identity, durable hosting/backups, rate limits, and versioned database migrations.
