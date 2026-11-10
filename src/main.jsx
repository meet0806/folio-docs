import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Mark } from '@tiptap/core';
import { EditorState } from '@tiptap/pm/state';
import { FileText, Plus, Search, Users, ArrowUpRight, Upload, ChevronDown, ChevronRight, ArrowLeft, MoreHorizontal, Check, Cloud, LoaderCircle, Bold, Italic, Underline as UnderlineIcon, List, ListOrdered, Undo2, Redo2, Download, X, LockKeyhole, Link, AlertCircle, PanelLeftClose, Menu, Feather } from 'lucide-react';
import './styles.css';

const Underline = Mark.create({ name: 'underline', parseHTML: () => [{ tag: 'u' }, { style: 'text-decoration', consuming: false, getAttrs: value => value.includes('underline') ? {} : false }], renderHTML: () => ['u', 0], addCommands() { return { toggleUnderline: () => ({ commands }) => commands.toggleMark(this.name) }; }, addKeyboardShortcuts() { return { 'Mod-u': () => this.editor.commands.toggleUnderline() }; } });
const blank = { type: 'doc', content: [{ type: 'paragraph' }] };
async function api(path, options = {}) {
  const response = await fetch('/api' + path, { ...options, headers: { ...(options.body && typeof options.body === 'string' ? { 'Content-Type': 'application/json' } : {}), ...options.headers } });
  const data = await response.json();
  if (!response.ok) { const e = new Error(data.error || 'Request failed.'); e.status = response.status; throw e; }
  return data;
}
const json = body => JSON.stringify(body);
const plainText = node => node.text || (node.content || []).map(plainText).join(['doc', 'bulletList', 'orderedList'].includes(node.type) ? '\n' : '');
const date = value => new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
function Avatar({ user, small }) { return <span className={`avatar ${user?.color || 'green'} ${small ? 'small' : ''}`}>{user?.initials || '?'}</span>; }
function App() {
  const [users, setUsers] = useState([]), [userId, setUserId] = useState('maya');
  const [documents, setDocuments] = useState([]), [doc, setDoc] = useState(null);
  const [filter, setFilter] = useState('all'), [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [saveStatus, setSaveStatus] = useState('saved'), [tick, setTick] = useState(0);
  const [accountMenu, setAccountMenu] = useState(false), [shareOpen, setShareOpen] = useState(false), [shares, setShares] = useState([]);
  const [shareBusy, setShareBusy] = useState(false), [shareError, setShareError] = useState(''), [toast, setToast] = useState(''), [mobileNav, setMobileNav] = useState(false);
  const docRef = useRef(null), dirty = useRef(false), revision = useRef(0), flight = useRef(null), fileInput = useRef(null), saveRef = useRef(null), editorRef = useRef(null);
  const user = users.find(u => u.id === userId), owner = users.find(u => u.id === doc?.owner);
  const editor = useEditor({ extensions: [StarterKit.configure({ heading: { levels: [1, 2, 3] } }), Underline], content: blank,
    editorProps: { attributes: { 'aria-label': 'Document content', role: 'textbox', 'aria-multiline': 'true', spellcheck: 'true' } },
    onUpdate: () => markDirty(),
  });
  editorRef.current = editor;
  function markDirty() { if (!docRef.current || docRef.current.role === 'viewer') return; dirty.current = true; revision.current++; setTick(t => t + 1); setSaveStatus(s => s === 'conflict' ? s : 'unsaved'); }
  async function refreshList() { const result = await api('/documents'); setDocuments(result.documents); return result.documents; }
  async function save() {
    if (flight.current) { const okay = await flight.current; if (!okay) return false; if (dirty.current && saveRef.current) return saveRef.current(); return !dirty.current; }
    if (!dirty.current || !docRef.current) return true;
    if (saveStatus === 'conflict') return false;
    const current = docRef.current, snapshot = revision.current;
    setSaveStatus('saving');
    const task = (async () => {
      try {
        const { document: saved } = await api(`/documents/${current.id}`, { method: 'PUT', body: json({ title: current.title, content: editorRef.current.getJSON(), version: current.version }) });
        docRef.current = { ...docRef.current, version: saved.version, updated_at: saved.updated_at };
        setDoc(docRef.current);
        setDocuments(list => [saved, ...list.filter(d => d.id !== saved.id)]);
        if (revision.current === snapshot) { dirty.current = false; setSaveStatus('saved'); } else setSaveStatus('unsaved');
        return true;
      } catch (e) { setSaveStatus(e.status === 409 ? 'conflict' : 'error'); setError(e.message); return false; }
      finally { flight.current = null; }
    })();
    flight.current = task;
    const okay = await task;
    if (okay && dirty.current) return saveRef.current();
    return okay;
  }
  saveRef.current = save;
  useEffect(() => { if (!dirty.current) return; const timer = setTimeout(() => saveRef.current(), 900); return () => clearTimeout(timer); }, [tick]);
  useEffect(() => {
    const guard = e => { if (dirty.current) { e.preventDefault(); e.returnValue = ''; } };
    const shortcut = e => { if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); saveRef.current(); } };
    window.addEventListener('beforeunload', guard); window.addEventListener('keydown', shortcut);
    return () => { window.removeEventListener('beforeunload', guard); window.removeEventListener('keydown', shortcut); };
  }, []);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(''), 3500); return () => clearTimeout(t); }, [toast]);
  useEffect(() => {
    (async () => {
      try { const session = await api('/session'); setUsers(session.users); setUserId(session.user); await refreshList(); }
      catch (e) { setError(e.message); }
      finally { setLoading(false); }
    })();
  }, []);
  useEffect(() => {
    if (loading || !editor) return;
    const id = new URLSearchParams(location.search).get('doc');
    if (id) openDocument(id);
  }, [loading, !!editor]);
  function applyDocument(next) {
    docRef.current = next; setDoc(next); dirty.current = false; revision.current = 0;
    editor.commands.setContent(next.content, false); editor.setEditable(next.role !== 'viewer');
    editor.view.updateState(EditorState.create({ doc: editor.state.doc, schema: editor.state.schema, plugins: editor.state.plugins }));
    setSaveStatus('saved'); setError(''); setMobileNav(false);
    history.replaceState(null, '', `?doc=${encodeURIComponent(next.id)}`);
  }
  async function openDocument(id) {
    if (!await saveRef.current()) return;
    setBusy(true);
    try { const result = await api(`/documents/${id}`); applyDocument(result.document); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  async function goHome(nextFilter = filter) {
    if (!await saveRef.current()) return;
    docRef.current = null; setDoc(null); setFilter(nextFilter); setMobileNav(false); setError(''); history.replaceState(null, '', location.pathname);
    try { await refreshList(); } catch (e) { setError(e.message); }
  }
  async function create() {
    if (!await saveRef.current()) return;
    setBusy(true);
    try { const result = await api('/documents', { method: 'POST', body: json({ title: 'Untitled document', content: blank }) }); applyDocument(result.document); await refreshList(); setTimeout(() => document.getElementById('document-title')?.select(), 0); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  async function changeUser(id) {
    if (!await saveRef.current()) return;
    setBusy(true);
    try { await api('/session', { method: 'POST', body: json({ user: id }) }); setUserId(id); setAccountMenu(false); docRef.current = null; setDoc(null); setFilter('all'); history.replaceState(null, '', location.pathname); await refreshList(); setToast('Switched demo account'); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  async function importFile(event) {
    const file = event.target.files[0]; event.target.value = '';
    if (!file) return;
    if (!/\.(txt|md)$/i.test(file.name) || file.size > 100000) { setError('Choose a .txt or .md file, up to 100 KB.'); return; }
    if (!await saveRef.current()) return;
    setBusy(true);
    try { const result = await api('/import', { method: 'POST', headers: { 'Content-Type': 'application/octet-stream', 'X-File-Name': encodeURIComponent(file.name) }, body: await file.arrayBuffer() }); applyDocument(result.document); await refreshList(); setToast('File imported. Make it your own.'); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  async function openSharing() {
    if (!await saveRef.current()) return;
    setShareBusy(true); setShareError(''); setShareOpen(true);
    try { setShares((await api(`/documents/${docRef.current.id}/shares`)).shares); } catch (e) { setShareError(e.message); } finally { setShareBusy(false); }
  }
  async function changeShare(id, role) {
    setShareBusy(true); setShareError('');
    try { setShares((await api(`/documents/${doc.id}/shares`, { method: 'POST', body: json({ user_id: id, role }) })).shares); setToast(role === 'remove' ? 'Access removed' : 'Sharing updated'); }
    catch (e) { setShareError(e.message); } finally { setShareBusy(false); }
  }
  function exportDraft() {
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Folio document</title></head><body><h1>${doc.title.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))}</h1>${editor.getHTML()}</body></html>`;
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html' })); const a = document.createElement('a'); a.href = url; a.download = `${doc.title.replace(/[^a-z0-9 -]/gi, '').slice(0, 80) || 'document'}.html`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); setToast('Document exported with formatting');
  }
  async function reloadLatest() {
    if (!window.confirm('Reload the saved version? Unsaved changes will be replaced. Export your draft first to keep a copy.')) return;
    try { const result = await api(`/documents/${doc.id}`); applyDocument(result.document); } catch (e) { setError(e.message); }
  }
  const visible = documents.filter(d => (filter === 'all' || (filter === 'owned' ? d.owner === userId : d.owner !== userId)) && `${d.title} ${plainText(d.content)}`.toLowerCase().includes(search.toLowerCase()));
  const ownedCount = documents.filter(d => d.owner === userId).length;
  const wordCount = editor?.getText().trim().split(/\s+/).filter(Boolean).length || 0;
  const readonly = doc?.role === 'viewer';
  function Tool({ label, icon: Icon, active, action, disabled }) { return <button type="button" className={`tool ${active ? 'active' : ''}`} aria-label={label} title={label} aria-pressed={active} disabled={readonly || disabled} onMouseDown={e => e.preventDefault()} onClick={action}><Icon size={17}/></button>; }
  return <div className="app-shell">
    <input ref={fileInput} type="file" accept=".txt,.md,text/plain,text/markdown" hidden onChange={importFile}/>
    {mobileNav && <button className="nav-overlay" aria-label="Close navigation" onClick={() => setMobileNav(false)}/>}
    <aside className={`sidebar ${mobileNav ? 'open' : ''}`}>
      <button className="brand" onClick={() => goHome('all')} aria-label="Folio home"><span className="brand-mark"><Feather size={23}/></span>folio<span className="brand-dot">.</span></button>
      <div className="workspace"><span className="workspace-icon">a</span><div><strong>Ajaia workspace</strong><span>A little space for good work</span></div></div>
      <button className="primary new-button" onClick={create} disabled={busy || !editor || loading}><Plus size={18}/> New document <span className="shortcut">+</span></button>
      <div className="nav-label">WORKSPACE</div>
      <nav>{[['all', FileText, 'All documents', documents.length], ['owned', LockKeyhole, 'My documents', ownedCount], ['shared', Users, 'Shared with me', documents.length - ownedCount]].map(([id, Icon, label, count]) => <button key={id} className={`nav-item ${filter === id && !doc ? 'selected' : ''}`} onClick={() => goHome(id)}><Icon size={18}/>{label}<span>{count}</span></button>)}</nav>
      <div className="nav-label recent-label">RECENT DOCUMENTS</div>
      <div className="recent-list">{documents.slice(0, 5).map(d => <button key={d.id} className={`recent-item ${doc?.id === d.id ? 'selected' : ''}`} onClick={() => openDocument(d.id)} disabled={busy}><FileText size={15}/><span>{d.title}</span></button>)}</div>
      <div className="sidebar-bottom"><div className="demo-note"><span className="status-dot"/> A shared demo workspace<p>Try another account to explore sharing. Please use sample content.</p></div>
      <div className="account-wrap">{accountMenu && <div className="account-menu"><div className="nav-label">SWITCH DEMO ACCOUNT</div>{users.map(u => <button key={u.id} onClick={() => changeUser(u.id)} disabled={busy}><Avatar user={u} small/><span><strong>{u.name}</strong><small>{u.email}</small></span>{u.id === userId && <Check size={16}/>}</button>)}</div>}
      <button className="account" onClick={() => setAccountMenu(!accountMenu)} aria-expanded={accountMenu}><Avatar user={user}/><span><strong>{user?.name || 'Loading account…'}</strong><small>Demo account</small></span><ChevronDown size={16}/></button></div></div>
    </aside>
    <main>
      <header className="topbar"><div className="breadcrumb"><button className="mobile-menu icon-button" aria-label="Open navigation" onClick={() => setMobileNav(true)}><Menu size={20}/></button><span>Workspace</span><ChevronRight size={13}/><strong>{doc ? 'Document' : 'Documents'}</strong></div><span className="topbar-note"><span className="status-dot"/> Room for your next idea</span><Avatar user={user} small/></header>
      {error && <div className="error-banner" role="alert"><AlertCircle size={18}/><span>{error}</span><button className="icon-button" aria-label="Dismiss error" onClick={() => setError('')}><X size={16}/></button></div>}
      {loading ? <div className="loading"><LoaderCircle className="spin"/> Opening your workspace…</div> : !doc ? <section className="library">
        <div className="page-heading"><div><div className="eyebrow">YOUR TEAM’S THINKING, TOGETHER</div><h1>{filter === 'shared' ? 'Shared with you' : filter === 'owned' ? 'Your documents' : 'Your ideas live here.'}</h1><p>A first thought, a clear plan, a shared next step. Make room for it.</p></div><button className="secondary import-top" onClick={() => fileInput.current.click()} disabled={busy}><Upload size={16}/> Import a file</button></div>
        <div className="start-cards"><button className="start-card blank-card" onClick={create} disabled={busy || !editor}><span className="card-art"><span className="mini-page"><Plus size={26}/><i/><i/><i/></span><span className="tiny-spark">✦</span></span><span><strong>Start with a blank page</strong><small>Big things start somewhere.</small></span><ArrowUpRight size={19}/></button><button className="start-card import-card" onClick={() => fileInput.current.click()} disabled={busy}><span className="import-art"><Upload size={27}/></span><span><strong>Bring your words along</strong><small>Import .txt or .md · up to 100 KB</small></span><ArrowUpRight size={19}/></button></div>
        <div className="collection-head"><div className="tabs" role="group" aria-label="Filter documents">{[['all','All documents'],['owned','Owned by me'],['shared','Shared with me']].map(([v,label]) => <button key={v} className={filter === v ? 'active' : ''} onClick={() => setFilter(v)}>{label}{filter === v && <span>{visible.length}</span>}</button>)}</div><label className="search"><Search size={17}/><input aria-label="Search documents" placeholder="Search your documents" value={search} onChange={e => setSearch(e.target.value)}/>{search && <button aria-label="Clear search" className="icon-button" onClick={() => setSearch('')}><X size={14}/></button>}</label></div>
        <div className="document-table"><div className="table-heading"><span>DOCUMENT NAME</span><span>OWNER</span><span>LAST EDITED</span><span>ACCESS</span><span/></div>{visible.map(d => <button className="document-row" key={d.id} onClick={() => openDocument(d.id)} disabled={busy}><span className="document-name"><span className={`doc-icon ${d.owner === userId ? '' : 'violet'}`}><FileText size={22}/></span><span><strong>{d.title}</strong><small>{plainText(d.content).slice(0, 80) || 'A fresh page, ready for your ideas'}</small></span></span><span className="owner-cell"><Avatar user={users.find(u => u.id === d.owner)} small/>{d.owner === userId ? 'You' : users.find(u => u.id === d.owner)?.name.split(' ')[0]}</span><span className="date-cell">{date(d.updated_at)}</span><span className={`access-tag ${d.role === 'owner' ? '' : 'shared'}`}>{d.role === 'owner' ? <LockKeyhole size={12}/> : <Users size={12}/>} {d.role === 'owner' ? 'Owned' : d.role === 'viewer' ? 'Can view' : 'Can edit'}</span><ChevronRight size={16}/></button>)}</div>
        {!visible.length && <div className="empty-state"><FileText size={32}/><h2>{search ? 'No matching documents' : filter === 'shared' ? 'Good work is better together.' : 'A fresh start.'}</h2><p>{search ? 'Try a different title or a word from your document.' : filter === 'shared' ? 'Documents shared with this account will appear here.' : 'Create a document or bring in a file to get started.'}</p>{!search && <button className="secondary" onClick={create}><Plus size={16}/> Create a document</button>}</div>}
        <div className="library-footer"><span>{visible.length} document{visible.length !== 1 ? 's' : ''}</span><span>Less friction. More good work. <Feather size={14}/></span></div>
      </section> : <section className="editor-view">
        <div className="document-header"><button className="icon-button back-button" aria-label="Back to documents" onClick={() => goHome()}><ArrowLeft size={20}/></button><div className="title-and-status"><input id="document-title" aria-label="Document title" maxLength={120} disabled={readonly} value={doc.title} onChange={e => { docRef.current = { ...docRef.current, title: e.target.value }; setDoc(docRef.current); markDirty(); }}/><div className="save-state" aria-live="polite">{saveStatus === 'saving' ? <LoaderCircle size={13} className="spin"/> : saveStatus === 'saved' ? <Cloud size={14}/> : <AlertCircle size={13}/>} {readonly ? 'View-only document' : { saved: 'All changes saved', saving: 'Saving changes…', unsaved: 'Unsaved changes', error: 'Couldn’t save — retry below', conflict: 'Newer version available' }[saveStatus]}<span>·</span><span>Owned by {doc.owner === userId ? 'you' : owner?.name}</span></div></div><div className="document-actions"><button className="secondary export-button" onClick={exportDraft}><Download size={16}/><span>Export</span></button>{doc.role === 'owner' ? <button className="primary" onClick={openSharing}><Users size={16}/> Share</button> : <span className="access-tag shared"><Users size={13}/>{readonly ? 'Can view' : 'Can edit'}</span>}</div></div>
        {['error','conflict'].includes(saveStatus) && <div className="recovery-bar"><span>Your draft is still here. Export a copy before reloading.</span>{saveStatus === 'error' && <button className="secondary" onClick={() => saveRef.current()}>Retry save</button>}<button className="secondary" onClick={exportDraft}>Export draft</button><button className="secondary" onClick={reloadLatest}>Reload latest</button></div>}
        <div className="toolbar" role="toolbar" aria-label="Text formatting"><Tool label="Undo (Ctrl+Z)" icon={Undo2} action={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()}/><Tool label="Redo (Ctrl+Shift+Z)" icon={Redo2} action={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()}/><span className="tool-divider"/><select aria-label="Text style" disabled={readonly} value={editor.isActive('heading', { level: 1 }) ? '1' : editor.isActive('heading', { level: 2 }) ? '2' : editor.isActive('heading', { level: 3 }) ? '3' : 'paragraph'} onChange={e => e.target.value === 'paragraph' ? editor.chain().focus().setParagraph().run() : editor.chain().focus().toggleHeading({ level: Number(e.target.value) }).run()}><option value="paragraph">Normal text</option><option value="1">Heading 1</option><option value="2">Heading 2</option><option value="3">Heading 3</option></select><span className="tool-divider"/><Tool label="Bold (Ctrl+B)" icon={Bold} active={editor.isActive('bold')} action={() => editor.chain().focus().toggleBold().run()}/><Tool label="Italic (Ctrl+I)" icon={Italic} active={editor.isActive('italic')} action={() => editor.chain().focus().toggleItalic().run()}/><Tool label="Underline (Ctrl+U)" icon={UnderlineIcon} active={editor.isActive('underline')} action={() => editor.chain().focus().toggleUnderline().run()}/><span className="tool-divider"/><Tool label="Bulleted list" icon={List} active={editor.isActive('bulletList')} action={() => editor.chain().focus().toggleBulletList().run()}/><Tool label="Numbered list" icon={ListOrdered} active={editor.isActive('orderedList')} action={() => editor.chain().focus().toggleOrderedList().run()}/><span className="toolbar-spacer"/><span className="editor-mode"><span className="status-dot"/>{readonly ? 'Viewing' : 'Editing'}</span></div>
        <div className="page-canvas"><article className="paper"><div className="paper-eyebrow">{readonly ? 'SHARED WITH YOU' : 'MAKE ROOM FOR YOUR NEXT IDEA'}</div><EditorContent editor={editor}/>{editor.isEmpty && <div className="editor-placeholder">A good place to begin. Start writing…</div>}</article><div className="page-foot"><span>{wordCount} words</span><span>{readonly ? 'Ask the owner for edit access' : 'Changes save automatically'}<span className="status-dot"/></span></div></div>
      </section>}
    </main>
    {busy && <div className="busy-indicator" role="status"><LoaderCircle size={16} className="spin"/> One moment…</div>}
    {toast && <div className="toast" role="status"><Check size={17}/>{toast}</div>}
    {shareOpen && <ShareDialog close={() => setShareOpen(false)} title={doc.title}><p className="modal-description">Bring the right people into the conversation.</p><div className="people-list"><div className="person-row"><Avatar user={user}/><span><strong>{user.name} <small>(you)</small></strong><small>{user.email}</small></span><span className="owner-label">Owner</span></div>{users.filter(u => u.id !== userId).map(u => <div className="person-row" key={u.id}><Avatar user={u}/><span><strong>{u.name}</strong><small>{u.email}</small></span><select aria-label={`Access for ${u.name}`} value={shares.find(s => s.user_id === u.id)?.role || 'remove'} disabled={shareBusy} onChange={e => changeShare(u.id, e.target.value)}><option value="remove">No access</option><option value="viewer">Can view</option><option value="editor">Can edit</option></select></div>)}</div>{shareError && <p className="inline-error" role="alert">{shareError}</p>}<div className="sharing-explainer"><LockKeyhole size={17}/><span><strong>Only invited demo accounts have access</strong><p>Switch accounts in the sidebar to test sharing. Copying the link does not grant access.</p></span></div><div className="modal-footer"><button className="secondary" onClick={async () => { try { await navigator.clipboard.writeText(location.href); setToast('Document link copied'); } catch { setShareError('Could not copy. Copy the URL from your address bar.'); } }}><Link size={16}/> Copy link</button><button className="primary" onClick={() => setShareOpen(false)}>Done</button></div></ShareDialog>}
  </div>;
}
function ShareDialog({ close, title, children }) {
  const ref = useRef(null);
  useEffect(() => { const previous = document.activeElement; ref.current.showModal(); return () => previous?.focus(); }, []);
  return <dialog className="share-dialog" ref={ref} onCancel={close} onClick={e => { if (e.target === ref.current) close(); }} aria-labelledby="share-title"><div className="modal-header"><div><span className="eyebrow">BETTER, TOGETHER</span><h2 id="share-title">Share document</h2><div className="shared-title">{title}</div></div><button className="icon-button" aria-label="Close sharing" onClick={close}><X size={20}/></button></div>{children}</dialog>;
}
createRoot(document.getElementById('root')).render(<App/>);
