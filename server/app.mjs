import express from 'express';
import { USERS, validUser, listDocuments, getDocument, createDocument, saveDocument, getShares, setShare, importText, fail } from '../lib/documents.mjs';

export function createApp(db) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('X-Frame-Options', 'DENY');
    if (req.path.startsWith('/api/')) res.setHeader('Cache-Control', 'no-store');
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      const origin = req.get('origin');
      if (origin && origin !== `${req.protocol}://${req.get('host')}`) return res.status(403).json({ error: 'Cross-origin requests are not allowed.' });
      if (req.get('sec-fetch-site') === 'cross-site') return res.status(403).json({ error: 'Cross-site requests are not allowed.' });
    }
    const match = req.get('cookie')?.match(/(?:^|;\s*)folio_user=([^;]+)/);
    req.demoUser = match && validUser(match[1]) ? match[1] : 'maya';
    next();
  });
  app.use(express.json({ limit: '600kb' }));
  app.get('/api/health', async (req, res) => { await db.prepare('SELECT 1 AS ok').bind().first(); res.json({ status: 'ok' }); });
  app.get('/api/session', (req, res) => res.json({ user: req.demoUser, users: USERS }));
  app.post('/api/session', (req, res) => {
    if (!validUser(req.body?.user)) fail(400, 'Choose a demo account.');
    res.cookie('folio_user', req.body.user, { httpOnly: true, sameSite: 'lax', secure: req.secure, maxAge: 30 * 86400000 });
    res.json({ user: req.body.user });
  });
  app.get('/api/documents', async (req, res) => res.json({ documents: await listDocuments(db, req.demoUser) }));
  app.post('/api/documents', async (req, res) => res.status(201).json({ document: await createDocument(db, req.demoUser, req.body || {}) }));
  app.get('/api/documents/:id', async (req, res) => res.json({ document: await getDocument(db, req.params.id, req.demoUser) }));
  app.put('/api/documents/:id', async (req, res) => res.json({ document: await saveDocument(db, req.params.id, req.demoUser, req.body || {}) }));
  app.get('/api/documents/:id/shares', async (req, res) => res.json({ shares: await getShares(db, req.params.id, req.demoUser) }));
  app.post('/api/documents/:id/shares', async (req, res) => res.json({ shares: await setShare(db, req.params.id, req.demoUser, req.body || {}) }));
  app.post('/api/import', express.raw({ type: 'application/octet-stream', limit: 100000 }), async (req, res) => {
    if (!Buffer.isBuffer(req.body)) fail(400, 'Upload a text file.');
    let name, text;
    try { name = decodeURIComponent(req.get('x-file-name') || ''); text = new TextDecoder('utf-8', { fatal: true }).decode(req.body); }
    catch { fail(400, 'Use a valid UTF-8 text file.'); }
    const content = importText(name, text);
    res.status(201).json({ document: await createDocument(db, req.demoUser, { title: name.replace(/\.(txt|md)$/i, '').slice(0, 120) || 'Imported document', content }) });
  });
  app.use('/api', (req, res) => res.status(404).json({ error: 'Endpoint not found.' }));
  app.use((error, req, res, next) => {
    const status = error.status || 500;
    if (status >= 500) console.error(error);
    res.status(status).json({ error: status === 413 ? 'This file or document is too large.' : status >= 500 ? 'Something went wrong. Please try again.' : error.message });
  });
  return app;
}
