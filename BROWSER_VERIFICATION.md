# Browser verification

Core flows were exercised through Chrome's user interface against the local app. These results supplement the automated SQLite/HTTP tests; they do not establish full live workflow or visual/accessibility coverage. The separate live checks below confirm deployment availability.

| Check | Observed result |
| --- | --- |
| Library | Loaded the seeded account and its owned document |
| Create | New document opened and appeared in the recent list |
| Rename | Title changed to “Weekly product brief — walkthrough” and saved |
| Edit/autosave | Entered text; UI reported “All changes saved” |
| Inline formatting | Applied bold, italic, and underline in Chrome; a separate read-only API check confirmed all three marks persisted in JSON |
| Heading/refresh | Applied Heading 2, refreshed, and observed the saved title, heading, and content |
| Owner sharing | As Alex, granted Maya editor access and Sam viewer access |
| Shared library | Maya saw the document under Shared with me with “Can edit” |
| Shared edit | Maya edited the document; saved text was subsequently visible to Sam |
| Viewer UI | Sam saw “View-only document”; title and formatting controls were disabled |
| Markdown import | Observed WALKTHROUGH_SCRIPT.md imported as a new editable document with headings and a list, then reopened correctly after refresh |

## Bug found and corrected

Imported Markdown prose displayed apostrophes as `&#39;`. Marked's inline token text was escaped for HTML, while the application consumes plain text in editor JSON. The converter now undoes Marked's common inline escaping once, preserving code and keeping raw HTML literal. A new regression test covers apostrophes, ampersands, angle brackets in inline code, and double-decoding avoidance.

All **seven** automated tests and the production build passed after this fix. The fix itself is covered by the new regression test; a fresh import in the browser after restarting the updated server has not yet been checked. Existing imported documents are not rewritten automatically.

## Remaining verification

- Toolbar-created bulleted/numbered lists, export download, UI revocation, and error/conflict recovery.
- Read-only attempts to type into the viewer content surface, in addition to the disabled-control and server-permission checks already performed.
- Unobstructed desktop visual review, mobile layout, keyboard/accessibility audit.
- Reproducible clean Linux installation, full PostgreSQL contract, and live editing/import/sharing/persistence workflows.

## Recording

No usable walkthrough video was captured. Snipping Tool offered window-recording mode, but its controls failed with “foreground window did not report a process id.” The attempted local speech synthesis also failed earlier. The recording outline is included; the video URL remains pending.

## Live Render check — 2026-11-09

URL: https://folio-docs-hyar.onrender.com/

Chrome displayed the deployed document library under Alex, with the seeded launch checklist. Navigating to `/api/health` returned `{"status":"ok"}`; this endpoint runs a database query before responding. These observations confirm basic frontend, server, and database connectivity. The web-fetch tool could not access the site, so these results come from the actual Chrome UI. Native input was unreliable during attempted creation; no new live document, edit, import, or sharing test is claimed. The complete live workflow and unobstructed visual review remain pending.
