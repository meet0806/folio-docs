# Architecture and prioritization

## Product slice

Folio focuses on a complete document workflow: create, edit, save, reopen, import, and share. The library distinguishes owned and shared documents; the editor exposes formatting and save state; the sharing dialog makes each account's role explicit. Seeded accounts make the workflow reviewable without passwords or paid services.

The main tradeoff was to prioritize persistent content, enforceable access rules, and safe concurrent saves over live collaboration. Viewer/editor roles and HTML export are the two small extensions beyond the required baseline.

## Components

```text
React + Tiptap browser client
           |
     same-origin HTTP API
           |
      Express routes
           |
document service: validation, access checks, import conversion
           |
      database adapter
        /          \
local SQLite    PostgreSQL on Render (health checked)
```

React/Vite builds the client. Tiptap provides the rich-text document model and editing behavior. A small underline extension supplements StarterKit. Express serves the production assets and API from one origin, which keeps local setup and deployment simple. Development embeds Vite middleware in the same server.

The first prototype used a Sites/Worker scaffold. Once Render was requested, the active implementation moved into this standalone Node project. Only the active Render-targeted project is included in this submission package.

## Persistence and access

`documents` stores ID, owner, title, serialized editor JSON, version, and creation/update timestamps. `shares` stores document/account pairs and viewer/editor roles. A composite primary key prevents duplicate grants; a foreign key ties grants to documents. Owner and recipient indexes support listing.

SQLite uses Node's built-in database module, a local file, foreign keys, and WAL. The PostgreSQL adapter uses `pg`, parameterized statements, and transactions for batched seeds. It translates the small service SQL subset's placeholders and insert-ignore syntax. The initial schema is created at startup; this is suitable for the initial scoped exercise, but future schema changes should use tracked migrations.

The account catalog is fixed in code. A switchable HTTP-only cookie selects a demo identity, defaulting to Maya. This intentionally demonstrates authorization rather than secure authentication: any visitor can switch accounts. Owners alone manage grants; viewers cannot save; editors can update the document. Missing and inaccessible documents both return 404. Document links do not grant access.

## Save behavior

The UI debounces changes for approximately 900 ms, serializes saves, and attempts to flush changes before navigating or switching accounts. It displays saved, saving, unsaved, failure, and conflict states. Navigation is blocked when the draft cannot save, and a browser unload warning protects pending changes. Editor history is reset when opening a different document.

Each save includes the last observed version. A conditional SQL update checks both the version and edit permission, then increments the version. This prevents a stale tab from silently overwriting a newer save. A conflict returns 409 and leaves the draft in the current browser page for export and manual recovery. This is optimistic concurrency, not real-time collaboration or durable offline drafts.

## File and content handling

The client uploads raw bytes with a filename header. The server bounds upload size, requires a supported extension and valid UTF-8, and rejects empty/binary-looking inputs. Plain text becomes paragraphs. Markdown tokens are converted to a supported subset of editor JSON. Original files are not stored, avoiding an unnecessary attachment/blob-storage system.

The server validates node types, nesting, formatting marks, titles, and content size, retaining only recognized fields. The client renders through the editor schema rather than arbitrary imported HTML. SQL is parameterized. The API also rejects cross-origin mutations and sets no-store, framing, and MIME-sniffing response headers.

## Verification and limits

Seven automated tests passed on local SQLite and HTTP. They exercise denied access, viewer restrictions, owner-only sharing, revocation, conflict rejection, data persistence, seed preservation, imports, and invalid requests. The client production build passed, and the local server started successfully.

Core Chrome interaction checks were completed and are documented in BROWSER_VERIFICATION.md. The Render library and database health endpoint were verified in Chrome; broader visual/mobile checks and full live PostgreSQL workflows remain unverified. The dependency lockfile came from an offline Windows installation, so Linux build dependencies need a clean deployment check. Demo authentication is deliberately bypassable through account switching. The list API loads full accessible documents, which is acceptable for this small exercise but should become a paginated summary endpoint at larger scale. Access updates are enforced on requests; other open tabs do not receive push notifications.

## Next 2–4 hours

1. Verify a reproducible clean Linux build and PostgreSQL contract, and exercise the full live workflow on the deployed Render app.
2. Check formatting, keyboard navigation, autosave recovery, and sharing in desktop/mobile browsers; add a focused browser regression test.
3. Record the walkthrough and complete the Drive submission links.
4. If time remains, add durable draft recovery and clearer handling of account changes in other tabs.
