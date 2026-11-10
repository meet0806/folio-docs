# Walkthrough recording plan (approximately 4 minutes)

This is an outline for a recording, not a completed video. Run through the UI first, confirm the deployment works, and record only the functionality actually observed.

## 0:00–0:25 — Product and scope

Show the document library. Introduce Folio as a small shared workspace for writing, importing, and granting access to team documents. Explain that seeded accounts make the review quick and that the focus is a complete persisted workflow.

## 0:25–1:20 — Create and edit

Create a document named “Weekly product brief.” Add a heading, a short paragraph with bold/italic/underline, and a short list. Point out the save status. Return to the library, reopen the document, and refresh to demonstrate persisted formatting.

## 1:20–1:50 — Import and export

Import `samples/team-brief.md`. Show the converted heading, emphasis, and lists. Explain the UTF-8 `.txt`/`.md`, 100 KB limit and that importing creates an editable document. Briefly show formatted HTML export if time allows.

## 1:50–2:45 — Sharing

As Maya, grant Alex edit access. Switch to Alex and open “Shared with me.” Make a small edit. Switch to Maya, change Alex to viewer, then reopen as Alex to show read-only behavior. Explain that only owners manage grants and a copied link does not grant access.

## 2:45–3:20 — Implementation decisions

Explain React/Tiptap, the same-origin Express API, editor JSON, SQLite locally, and PostgreSQL on Render. Explain optimistic version checks: stale writes are rejected and the draft can be exported before reloading. State that real-time merge, real sign-in, comments, and DOCX support were deliberately omitted.

## 3:20–4:00 — AI and reliability

Show the automated test result. Explain that Codex accelerated scaffolding, implementation, and tests, and that a failing seed test prompted a concrete correction. Describe the completed deployment/browser checks accurately, without treating a build or API test as a full UI pass. Finish with what another 2–4 hours would improve.

## After recording

1. Publish the recording using the chosen host with reviewer-accessible visibility.
2. Put its actual URL in `WALKTHROUGH_URL.txt`.
3. Put the deployed application URL in `LIVE_URL.txt`.
4. Update `SUBMISSION.md`, regenerate the file inventory/ZIP, and upload the final package to Drive.
