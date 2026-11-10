import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createSqlite, createPostgres } from '../server/database.mjs';
import { createApp } from '../server/app.mjs';
import { seed, createDocument, getDocument, listDocuments, saveDocument, setShare, getShares, contentOf, importText, paragraph } from '../lib/documents.mjs';

const content = { type: 'doc', content: [paragraph('A useful idea.')] };
const title = 'Product notes';
const rejects = (fn, status) => assert.rejects(fn, e => e.status === status);
function contract(name, factory) {
 test(`${name}: permission and conflict contract`, async t => {
  const db = await factory(); t.after(() => db.close());
  const doc = await createDocument(db, 'maya', { title, content });
  assert.equal(doc.role, 'owner');
  await rejects(() => getDocument(db, doc.id, 'alex'), 404);
  assert.equal((await listDocuments(db, 'alex')).some(d => d.id === doc.id), false);
  await setShare(db, doc.id, 'maya', { user_id: 'alex', role: 'viewer' });
  assert.equal((await getDocument(db, doc.id, 'alex')).role, 'viewer');
  await rejects(() => saveDocument(db, doc.id, 'alex', { title, content, version: 1 }), 403);
  await rejects(() => setShare(db, doc.id, 'alex', { user_id: 'sam', role: 'editor' }), 403);
  await rejects(() => getShares(db, doc.id, 'alex'), 403);
  await setShare(db, doc.id, 'maya', { user_id: 'alex', role: 'editor' });
  const updated = await saveDocument(db, doc.id, 'alex', { title: 'Renamed by Alex', content, version: 1 });
  assert.equal(updated.version, 2);
  await rejects(() => saveDocument(db, doc.id, 'maya', { title: 'Stale title', content, version: 1 }), 409);
  assert.equal((await getDocument(db, doc.id, 'maya')).title, 'Renamed by Alex');
  await setShare(db, doc.id, 'maya', { user_id: 'alex', role: 'remove' });
  await rejects(() => getDocument(db, doc.id, 'alex'), 404);
  await rejects(() => saveDocument(db, doc.id, 'alex', { title, content, version: 2 }), 404);
 });
}
contract('SQLite', () => createSqlite());
if (process.env.TEST_DATABASE_URL) contract('PostgreSQL', () => createPostgres(process.env.TEST_DATABASE_URL));

test('formatted content and shares survive closing and reopening the database', async () => {
 const dir = mkdtempSync(join(tmpdir(), 'folio-test-')); const filename = join(dir, 'test.db');
 let db = createSqlite(filename);
 try {
  const formatted = importText('notes.md', '# Heading\n\n**Bold** and *italic*\n\n- First\n- Second');
  const doc = await createDocument(db, 'maya', { title, content: formatted });
  await setShare(db, doc.id, 'maya', { user_id: 'sam', role: 'editor' });
  await db.close(); db = createSqlite(filename);
  const reopened = await getDocument(db, doc.id, 'sam');
  assert.deepEqual(reopened.content, formatted); assert.equal(reopened.role, 'editor');
 } finally { await db.close(); rmSync(dir, { recursive: true }); }
});
test('seeding is idempotent and never overwrites edited seed content', async t => {
 const db = createSqlite(); t.after(() => db.close()); await seed(db);
 await saveDocument(db, 'welcome', 'maya', { title: 'My own title', content, version: 1 });
 await setShare(db, 'launch', 'alex', { user_id: 'maya', role: 'remove' });
 await seed(db); assert.equal((await getDocument(db, 'welcome', 'maya')).title, 'My own title');
 assert.equal((await listDocuments(db, 'maya')).length, 1);
});
test('validation rejects unsafe structures, blank titles, bad roles and over-limit documents', async t => {
 const db = createSqlite(); t.after(() => db.close());
 await rejects(() => createDocument(db, 'maya', { title: ' ', content }), 400);
 assert.throws(() => contentOf({ type: 'doc', content: [{ type: 'script', text: 'alert(1)' }] }), e => e.status === 400);
 assert.throws(() => contentOf({ type: 'doc', content: [{ type: 'text', text: 'Invalid at root' }] }), e => e.status === 400);
 assert.throws(() => contentOf({ type: 'doc', content: [paragraph('x'.repeat(500001))] }), e => e.status === 413);
 const doc = await createDocument(db, 'maya', { title, content });
 await rejects(() => setShare(db, doc.id, 'maya', { user_id: 'sam', role: 'admin' }), 400);
 await rejects(() => setShare(db, doc.id, 'maya', { user_id: 'unknown', role: 'editor' }), 400);
});
test('import preserves common Markdown structure and treats HTML as literal text', () => {
 const doc = importText('brief.md', '# Brief\n\n**Bold**, *italic* and `code`\n\n1. One\n2. Two\n\n<script>alert(1)</script>');
 assert.equal(doc.content[0].type, 'heading');
 assert.ok(doc.content[1].content.some(n => n.marks?.some(m => m.type === 'bold')));
 assert.equal(doc.content[2].type, 'orderedList');
 assert.equal(doc.content[3].type, 'paragraph');
 assert.ok(doc.content[3].content[0].text.includes('<script>'));
 assert.throws(() => importText('x.docx', 'text'), e => e.status === 400);
 assert.throws(() => importText('x.txt', ' '), e => e.status === 400);
 assert.throws(() => importText('x.txt', '\0abc'), e => e.status === 400);
});
test('Markdown import preserves apostrophes, ampersands, and inline code without double decoding', () => {
 const doc = importText('punctuation.md', "It's a team's plan & **\"feedback\"**. Use `a < b && c > d` and `&amp;`.\n\n<script>safe literal</script>");
 const text = doc.content[0].content.map(n => n.text || '').join('');
 assert.equal(text, "It's a team's plan & \"feedback\". Use a < b && c > d and &amp;.");
 assert.ok(doc.content[0].content.some(n => n.marks?.some(m => m.type === 'code') && n.text === 'a < b && c > d'));
 assert.equal(doc.content[1].content[0].text, '<script>safe literal</script>');
});
test('HTTP flow: session, create, import, authorization, request limits and cross-origin protection', async t => {
 const db = createSqlite(); const app = createApp(db);
 const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
 t.after(async () => { await new Promise(resolve => server.close(resolve)); await db.close(); });
 const base = `http://127.0.0.1:${server.address().port}/api`;
 const request = (path, options = {}) => fetch(base + path, options);
 const session = await request('/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user: 'maya' }) });
 assert.equal(session.status, 200); assert.match(session.headers.get('set-cookie'), /HttpOnly/);
 const response = await request('/documents', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, content }) });
 assert.equal(response.status, 201); const { document: doc } = await response.json();
 assert.equal((await request(`/documents/${doc.id}`, { headers: { Cookie: 'folio_user=alex' } })).status, 404);
 const imported = await request('/import', { method: 'POST', headers: { 'Content-Type': 'application/octet-stream', 'X-File-Name': 'plan.md' }, body: '# Plan\n\n- Write\n- Share' });
 assert.equal(imported.status, 201); assert.equal((await imported.json()).document.content.content[0].type, 'heading');
 const tooBig = await request('/import', { method: 'POST', headers: { 'Content-Type': 'application/octet-stream', 'X-File-Name': 'large.txt' }, body: 'x'.repeat(100001) });
 assert.equal(tooBig.status, 413);
 const invalidUtf = await request('/import', { method: 'POST', headers: { 'Content-Type': 'application/octet-stream', 'X-File-Name': 'bad.txt' }, body: new Uint8Array([0xff, 0xfe]) });
 assert.equal(invalidUtf.status, 400);
 const csrf = await request('/session', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://unrelated.example' }, body: JSON.stringify({ user: 'sam' }) });
 assert.equal(csrf.status, 403);
 const invalidJson = await request('/documents', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' });
 assert.equal(invalidJson.status, 400);
});
