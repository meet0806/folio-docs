import { marked } from 'marked';

export const USERS = [
  { id: 'maya', name: 'Maya Chen', email: 'maya@folio.demo', initials: 'MC', color: 'green' },
  { id: 'alex', name: 'Alex Morgan', email: 'alex@folio.demo', initials: 'AM', color: 'purple' },
  { id: 'sam', name: 'Sam Rivera', email: 'sam@folio.demo', initials: 'SR', color: 'orange' },
];
export class AppError extends Error { constructor(status, message) { super(message); this.status = status; } }
export function fail(status, message) { throw new AppError(status, message); }
export function validUser(id) { return USERS.some(u => u.id === id); }
export function titleOf(value) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 120) fail(400, 'Give your document a title between 1 and 120 characters.');
  return value.trim();
}
const nodeTypes = new Set(['doc', 'paragraph', 'text', 'heading', 'bulletList', 'orderedList', 'listItem', 'blockquote', 'codeBlock', 'hardBreak', 'horizontalRule']);
const markTypes = new Set(['bold', 'italic', 'underline', 'strike', 'code']);
export function contentOf(value) {
  let count = 0;
  function walk(n, depth) {
    if (++count > 20000 || depth > 30 || !n || typeof n !== 'object' || !nodeTypes.has(n.type)) fail(400, 'Unsupported document structure.');
    const result = { type: n.type };
    if (n.type === 'text') {
      if (typeof n.text !== 'string' || !n.text.length) fail(400, 'Invalid text.');
      result.text = n.text;
    }
    if (n.type === 'heading') result.attrs = { level: [1, 2, 3].includes(n.attrs?.level) ? n.attrs.level : 2 };
    if (n.type === 'orderedList') result.attrs = { start: Number.isInteger(n.attrs?.start) && n.attrs.start > 0 ? Math.min(n.attrs.start, 10000) : 1 };
    if (n.marks) {
      if (!Array.isArray(n.marks) || n.marks.some(m => !markTypes.has(m.type))) fail(400, 'Unsupported text formatting.');
      result.marks = n.marks.map(m => ({ type: m.type }));
    }
    if (n.content) {
      if (!Array.isArray(n.content)) fail(400, 'Invalid content.');
      result.content = n.content.map(c => walk(c, depth + 1));
    }
    const children = result.content || [];
    const blocks = ['paragraph', 'heading', 'bulletList', 'orderedList', 'blockquote', 'codeBlock', 'horizontalRule'];
    const allowed = ['doc', 'blockquote', 'listItem'].includes(n.type) ? blocks : ['bulletList', 'orderedList'].includes(n.type) ? ['listItem'] : ['paragraph', 'heading'].includes(n.type) ? ['text', 'hardBreak'] : n.type === 'codeBlock' ? ['text'] : [];
    if (children.some(c => !allowed.includes(c.type))) fail(400, 'Invalid content nesting.');
    if (['doc', 'blockquote', 'bulletList', 'orderedList', 'listItem'].includes(n.type) && !children.length) fail(400, 'Invalid empty block.');
    if (n.type === 'listItem' && children[0]?.type !== 'paragraph') fail(400, 'A list item must start with a paragraph.');
    return result;
  }
  if (value?.type !== 'doc') fail(400, 'Content must be a document.');
  const cleaned = walk(value, 0);
  if (JSON.stringify(cleaned).length > 500000) fail(413, 'Document exceeds the 500 KB content limit.');
  return cleaned;
}
const textNode = text => text ? [{ type: 'text', text }] : [];
// Marked escapes inline token text for an HTML renderer. Our renderer consumes
// JSON text instead, so undo that escaping once (never interpret it as HTML).
const unescapeInline = text => text.replace(/&(amp|lt|gt|quot|#39);/g, (_, entity) => ({ amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'" }[entity]));
export const paragraph = text => ({ type: 'paragraph', ...(text ? { content: textNode(text) } : {}) });
export function importText(name, text) {
  if (!/\.(txt|md)$/i.test(name)) fail(400, 'Choose a .txt or .md file.');
  if (!text.trim()) fail(400, 'This file is empty.');
  if (text.includes('\0')) fail(400, 'This looks like a binary file. Use UTF-8 text.');
  function inline(tokens = []) {
    return tokens.flatMap(t => {
      if (['strong', 'em', 'del'].includes(t.type)) return inline(t.tokens).map(n => ({ ...n, marks: [...(n.marks || []), { type: { strong: 'bold', em: 'italic', del: 'strike' }[t.type] }] }));
      if (t.type === 'codespan') return [{ type: 'text', text: unescapeInline(t.text || ' '), marks: [{ type: 'code' }] }];
      if (t.type === 'br') return [{ type: 'hardBreak' }];
      if (t.type === 'link') return inline(t.tokens);
      const text = t.text ?? t.raw ?? '';
      return textNode(t.type === 'html' ? text : unescapeInline(text));
    });
  }
  function blocks(tokens) {
    return tokens.flatMap(t => {
      if (t.type === 'space') return [];
      if (t.type === 'heading') return [{ type: 'heading', attrs: { level: Math.min(t.depth, 3) }, content: inline(t.tokens) }];
      if (t.type === 'list') return [{ type: t.ordered ? 'orderedList' : 'bulletList', content: t.items.map(i => { const c = blocks(i.tokens); return { type: 'listItem', content: c[0]?.type === 'paragraph' ? c : [paragraph(''), ...c] }; }) }];
      if (t.type === 'blockquote') return [{ type: 'blockquote', content: blocks(t.tokens) }];
      if (t.type === 'code') return [{ type: 'codeBlock', content: textNode(t.text) }];
      if (t.type === 'hr') return [{ type: 'horizontalRule' }];
      return [{ type: 'paragraph', content: t.tokens ? inline(t.tokens) : textNode(t.text ?? t.raw ?? '') }];
    });
  }
  return contentOf({ type: 'doc', content: /\.md$/i.test(name) ? blocks(marked.lexer(text)) : text.split(/\r?\n/).map(paragraph) });
}
export async function seed(db) {
  if (await db.prepare("SELECT id FROM documents WHERE id = 'welcome'").bind().first()) return;
  const now = new Date().toISOString();
  const welcome = { type: 'doc', content: [
    { type: 'heading', attrs: { level: 1 }, content: textNode('Good work starts with a little space.') },
    paragraph('Welcome to Folio. A calm place to turn first thoughts into something your team can build on.'),
    { type: 'heading', attrs: { level: 2 }, content: textNode('Make yourself at home') },
    { type: 'bulletList', content: ['Write freely. Your changes save automatically.', 'Make it yours with headings, lists, and a little emphasis.', 'Share with Alex or Sam, then switch accounts to see their view.'].map(t => ({ type: 'listItem', content: [paragraph(t)] })) },
    { type: 'blockquote', content: [paragraph('Small ideas deserve a place to grow.')] },
    paragraph('This is a shared demo workspace. Use sample content only.'),
  ] };
  await db.batch([
    db.prepare('INSERT OR IGNORE INTO documents (id, owner, title, content, version, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)').bind('welcome', 'maya', 'A little space for good ideas', JSON.stringify(welcome), now, now),
    db.prepare('INSERT OR IGNORE INTO documents (id, owner, title, content, version, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)').bind('launch', 'alex', 'Launch day checklist', JSON.stringify({ type: 'doc', content: [{ type: 'heading', attrs: { level: 1 }, content: textNode('Ready for the next chapter') }, paragraph('A shared checklist for a thoughtful launch.'), { type: 'bulletList', content: ['Review the core user journey', 'Invite a teammate to give feedback', 'Celebrate the small wins'].map(t => ({ type: 'listItem', content: [paragraph(t)] })) }] }), now, now),
    db.prepare("INSERT OR IGNORE INTO shares (document_id, user_id, role) VALUES ('launch', 'maya', 'editor')").bind(),
  ]);
}
function hydrate(row) { return row ? { ...row, content: JSON.parse(row.content) } : null; }
export async function listDocuments(db, user) {
  const r = await db.prepare("SELECT d.*, CASE WHEN d.owner = ? THEN 'owner' ELSE s.role END AS role FROM documents d LEFT JOIN shares s ON s.document_id = d.id AND s.user_id = ? WHERE d.owner = ? OR s.user_id = ? ORDER BY d.updated_at DESC").bind(user, user, user, user).all();
  return r.results.map(hydrate);
}
export async function getDocument(db, id, user) {
  const row = await db.prepare("SELECT d.*, CASE WHEN d.owner = ? THEN 'owner' ELSE s.role END AS role FROM documents d LEFT JOIN shares s ON s.document_id = d.id AND s.user_id = ? WHERE d.id = ? AND (d.owner = ? OR s.user_id = ?)").bind(user, user, id, user, user).first();
  if (!row) fail(404, 'Document not found or access has been removed.');
  return hydrate(row);
}
export async function createDocument(db, user, input) {
  const id = crypto.randomUUID(), now = new Date().toISOString();
  await db.prepare('INSERT INTO documents (id, owner, title, content, version, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)').bind(id, user, titleOf(input.title), JSON.stringify(contentOf(input.content)), now, now).run();
  return getDocument(db, id, user);
}
export async function saveDocument(db, id, user, input) {
  const doc = await getDocument(db, id, user);
  if (doc.role === 'viewer') fail(403, 'You have view-only access to this document.');
  if (!Number.isInteger(input.version)) fail(400, 'A document version is required.');
  const result = await db.prepare("UPDATE documents SET title = ?, content = ?, version = version + 1, updated_at = ? WHERE id = ? AND version = ? AND (owner = ? OR EXISTS (SELECT 1 FROM shares WHERE document_id = ? AND user_id = ? AND role = 'editor'))").bind(titleOf(input.title), JSON.stringify(contentOf(input.content)), new Date().toISOString(), id, input.version, user, id, user).run();
  if (!result.meta.changes) fail(409, 'A newer version is available. Export your draft, then reload the latest version.');
  return getDocument(db, id, user);
}
export async function getShares(db, id, user) {
  const doc = await getDocument(db, id, user);
  if (doc.owner !== user) fail(403, 'Only the owner can manage sharing.');
  return (await db.prepare('SELECT user_id, role FROM shares WHERE document_id = ?').bind(id).all()).results;
}
export async function setShare(db, id, user, input) {
  await getShares(db, id, user);
  if (!validUser(input.user_id) || input.user_id === user) fail(400, 'Choose another demo account.');
  if (!['editor', 'viewer', 'remove'].includes(input.role)) fail(400, 'Choose editor or viewer access.');
  if (input.role === 'remove') await db.prepare('DELETE FROM shares WHERE document_id = ? AND user_id = ?').bind(id, input.user_id).run();
  else await db.prepare('INSERT INTO shares (document_id, user_id, role) VALUES (?, ?, ?) ON CONFLICT(document_id, user_id) DO UPDATE SET role = excluded.role').bind(id, input.user_id, input.role).run();
  return getShares(db, id, user);
}
